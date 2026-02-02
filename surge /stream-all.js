/*
 * 由@LucaLin233编写
 * 由@Rabbit-Spec修改
 * 新增 ChatGPT 检测功能
 * 更新日期：2024.06.01 (Modified 2024)
 */

const REQUEST_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.61 Safari/537.36',
    'Accept-Language': 'en',
}

const STATUS_COMING = 2
const STATUS_AVAILABLE = 1
const STATUS_NOT_AVAILABLE = 0
const STATUS_TIMEOUT = -1
const STATUS_ERROR = -2

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.61 Safari/537.36'

;(async () => {
    let panel_result = {
        title: '流媒体解锁检测',
        content: '',
        icon: 'play.tv.fill',
        'icon-color': '#FF2D55',
    }

    // 并发执行所有检测
    let [{ region, status }] = await Promise.all([testDisneyPlus()])
    
    await Promise.all([
        check_youtube_premium(),
        check_netflix(),
        check_chatgpt() // 新增 ChatGPT
    ])
    .then((result) => {
        let disney_result = ""
        if (status == STATUS_COMING) {
            disney_result = "Disney+: 即将登陆~" + region.toUpperCase()
        } else if (status == STATUS_AVAILABLE) {
            disney_result = "Disney+: 已解锁 ➟ " + region.toUpperCase()
        } else if (status == STATUS_NOT_AVAILABLE) {
            disney_result = "Disney+: 未支持 🚫 "
        } else if (status == STATUS_TIMEOUT) {
            disney_result = "Disney+: 检测超时 🚦"
        } else {
            disney_result = "Disney+: 检测异常 ⚠️"
        }

        result.push(disney_result)
        panel_result['content'] = result.join('\n')
    })
    .finally(() => {
        $done(panel_result)
    })
})()

// --- 新增 ChatGPT 检测函数 ---
async function check_chatgpt() {
    return new Promise((resolve) => {
        let option = {
            url: 'https://chatgpt.com',
            headers: REQUEST_HEADERS,
            timeout: 5000
        }
        $httpClient.post(option, (error, response, data) => {
            let res = 'ChatGPT: '
            if (error) {
                res += '检测失败 ⚠️'
            } else if (response.status === 403) {
                res += '拒绝访问 (403) 🚫'
            } else if (response.status === 429) {
                res += '请求频繁 (429) ⏳'
            } else if (response.status === 200) {
                res += '已解锁 ✅'
            } else {
                res += '不支持该地区 ✖️'
            }
            resolve(res)
        })
    })
}

// --- 原有 YouTube 函数 ---
async function check_youtube_premium() {
    return new Promise((resolve) => {
        let option = {
            url: 'https://www.youtube.com/premium',
            headers: REQUEST_HEADERS,
        }
        $httpClient.get(option, function (error, response, data) {
            let res = 'YouTube: '
            if (error || response.status !== 200) {
                resolve(res + '检测失败')
                return
            }
            if (data.indexOf('Premium is not available in your country') !== -1) {
                resolve(res + '不支持解锁')
                return
            }
            let re = new RegExp('"countryCode":"(.*?)"', 'gm')
            let result = re.exec(data)
            let region = result ? result[1] : (data.indexOf('www.google.cn') !== -1 ? 'CN' : 'US')
            resolve(res + '已解锁 ➟ ' + region.toUpperCase())
        })
    })
}

// --- 原有 Netflix 函数 ---
async function check_netflix() {
    let inner_check = (filmId) => {
        return new Promise((resolve, reject) => {
            let option = { url: 'https://www.netflix.com/title/' + filmId, headers: REQUEST_HEADERS }
            $httpClient.get(option, function (error, response, data) {
                if (error) return reject('Error')
                if (response.status === 403) return reject('Not Available')
                if (response.status === 404) return resolve('Not Found')
                if (response.status === 200) {
                    let url = response.headers['x-originating-url'] || ''
                    let region = url.split('/')[3]?.split('-')[0] || 'US'
                    return resolve(region === 'title' ? 'US' : region)
                }
                reject('Error')
            })
        })
    }

    try {
        let code = await inner_check(81280792)
        if (code === 'Not Found') {
            let code2 = await inner_check(80018499)
            if (code2 === 'Not Found') return 'Netflix: 该节点不支持'
            return 'Netflix: 仅解锁自制剧 ➟ ' + code2.toUpperCase()
        }
        return 'Netflix: 已完整解锁 ➟ ' + code.toUpperCase()
    } catch (e) {
        return 'Netflix: 检测失败'
    }
}

// --- 原有 Disney Plus 函数 ---
async function testDisneyPlus() {
    try {
        let { region, cnbl } = await Promise.race([testHomePage(), timeout(7000)])
        let { countryCode, inSupportedLocation } = await Promise.race([getLocationInfo(), timeout(7000)])
        region = countryCode ?? region
        if (inSupportedLocation === false || inSupportedLocation === 'false') {
            return { region, status: STATUS_COMING }
        } else {
            return { region, status: STATUS_AVAILABLE }
        }
    } catch (error) {
        if (error === 'Not Available') return { status: STATUS_NOT_AVAILABLE }
        if (error === 'Timeout') return { status: STATUS_TIMEOUT }
        return { status: STATUS_ERROR }
    }
}

function getLocationInfo() {
    return new Promise((resolve, reject) => {
        let opts = {
            url: 'https://disney.api.edge.bamgrid.com/graph/v1/device/graphql',
            headers: {
                'Accept-Language': 'en',
                Authorization: 'ZGlzbmV5JmJyb3dzZXImMS4wLjA.Cu56AgSfBTDag5NiRA81oLHkDZfu5L3CKadnefEAY84',
                'Content-Type': 'application/json',
                'User-Agent': UA,
            },
            body: JSON.stringify({
                query: 'mutation registerDevice($input: RegisterDeviceInput!) { registerDevice(registerDevice: $input) { grant { grantType assertion } } }',
                variables: {
                    input: {
                        applicationRuntime: 'chrome',
                        attributes: { browserName: 'chrome', browserVersion: '94.0.4606', manufacturer: 'apple', model: null, operatingSystem: 'macintosh', operatingSystemVersion: '10.15.7', osDeviceIds: [] },
                        deviceFamily: 'browser',
                        deviceLanguage: 'en',
                        deviceProfile: 'macosx',
                    },
                },
            }),
        }
        $httpClient.post(opts, (error, response, data) => {
            if (error) return reject('Error')
            if (response.status !== 200) return reject('Not Available')
            let json = JSON.parse(data)
            let sdk = json?.extensions?.sdk
            resolve({
                inSupportedLocation: sdk?.session?.inSupportedLocation,
                countryCode: sdk?.session?.location?.countryCode,
                accessToken: sdk?.token?.accessToken
            })
        })
    })
}

function testHomePage() {
    return new Promise((resolve, reject) => {
        let opts = { url: 'https://www.disneyplus.com/', headers: { 'Accept-Language': 'en', 'User-Agent': UA } }
        $httpClient.get(opts, (error, response, data) => {
            if (error) return reject('Error')
            if (response.status !== 200 || data.indexOf('Sorry, Disney+ is not available in your region.') !== -1) return reject('Not Available')
            let match = data.match(/Region: ([A-Za-z]{2})[\s\S]*?CNBL: ([12])/)
            resolve(match ? { region: match[1], cnbl: match[2] } : { region: '', cnbl: '' })
        })
    })
}

function timeout(delay = 5000) {
    return new Promise((resolve, reject) => {
        setTimeout(() => reject('Timeout'), delay)
    })
}
