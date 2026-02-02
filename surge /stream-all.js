/*
 * 流媒体解锁检测脚本 (含 ChatGPT 优化版)
 * 由 @LucaLin233 编写，@Rabbit-Spec 修改
 * 更新日期：2024.06.01 (Optimized 2024)
 */

const REQUEST_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
    'Accept-Language': 'en',
}

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.61 Safari/537.36'

const STATUS_COMING = 2
const STATUS_AVAILABLE = 1
const STATUS_NOT_AVAILABLE = 0
const STATUS_TIMEOUT = -1
const STATUS_ERROR = -2

;(async () => {
    let panel_result = {
        title: '流媒体解锁检测',
        content: '',
        icon: 'play.tv.fill',
        'icon-color': '#FF2D55',
    }

    // 并发执行任务
    let disneyTask = testDisneyPlus()
    let otherTasks = Promise.all([
        check_chatgpt(),
        check_youtube_premium(),
        check_netflix()
    ])

    try {
        const [chatgpt, youtube, netflix] = await otherTasks
        const disneyInfo = await disneyTask
        
        let disney_res = ""
        if (disneyInfo.status == STATUS_AVAILABLE) {
            disney_res = "Disney+: 已解锁 ➟ " + disneyInfo.region.toUpperCase()
        } else if (disneyInfo.status == STATUS_COMING) {
            disney_res = "Disney+: 即将登陆 ➟ " + disneyInfo.region.toUpperCase()
        } else {
            disney_res = "Disney+: 未支持 🚫"
        }

        // 组装内容
        panel_result['content'] = [chatgpt, youtube, netflix, disney_res].join('\n')
    } catch (e) {
        panel_result['content'] = '检测发生异常，请检查网络'
    } finally {
        $done(panel_result)
    }
})()

// --- 优化后的 ChatGPT 检测 ---
async function check_chatgpt() {
    return new Promise((resolve) => {
        let option = {
            url: 'https://chatgpt.com/backend-api/sentinel/anon-check',
            headers: REQUEST_HEADERS,
            timeout: 5000
        }
        $httpClient.get(option, (error, response, data) => {
            let res = 'ChatGPT: '
            if (error) return resolve(res + '检测失败 ⚠️')
            
            const status = response.status
            if (status === 200) {
                resolve(res + '已解锁 ✅')
            } else if (status === 403) {
                resolve(res + '拒绝访问 (IP被封) 🚫')
            } else if (status === 429) {
                resolve(res + '请求频繁 (429) ⏳')
            } else {
                resolve(res + '不支持该地区 ✖️')
            }
        })
    })
}

// --- YouTube 检测 ---
async function check_youtube_premium() {
    return new Promise((resolve) => {
        let option = { url: 'https://www.youtube.com/premium', headers: REQUEST_HEADERS }
        $httpClient.get(option, (error, response, data) => {
            let res = 'YouTube: '
            if (error || response.status !== 200) return resolve(res + '检测失败')
            if (data.indexOf('Premium is not available in your country') !== -1) return resolve(res + '不支持解锁')
            let re = /"countryCode":"(.*?)"/gm
            let match = re.exec(data)
            let region = match ? match[1] : (data.indexOf('www.google.cn') !== -1 ? 'CN' : 'US')
            resolve(res + '已解锁 ➟ ' + region.toUpperCase())
        })
    })
}

// --- Netflix 检测 ---
async function check_netflix() {
    let inner_check = (filmId) => {
        return new Promise((resolve, reject) => {
            let option = { url: 'https://www.netflix.com/title/' + filmId, headers: REQUEST_HEADERS }
            $httpClient.get(option, (error, response, data) => {
                if (error || response.status === 403) return reject()
                if (response.status === 404) return resolve('NF')
                if (response.status === 200) {
                    let url = response.headers['x-originating-url'] || ''
                    let region = url.split('/')[3]?.split('-')[0] || 'US'
                    return resolve(region.toUpperCase())
                }
                reject()
            })
        })
    }
    try {
        let code = await inner_check(81280792)
        if (code === 'NF') {
            let code2 = await inner_check(80018499)
            return (code2 === 'NF') ? 'Netflix: 该节点不支持' : 'Netflix: 仅解锁自制剧 ➟ ' + code2
        }
        return 'Netflix: 已完整解锁 ➟ ' + code
    } catch (e) { return 'Netflix: 检测失败' }
}

// --- Disney Plus 检测 ---
async function testDisneyPlus() {
    try {
        let { countryCode, inSupportedLocation } = await getLocationInfo()
        if (inSupportedLocation === false || inSupportedLocation === 'false') {
            return { region: countryCode, status: STATUS_COMING }
        } else {
            return { region: countryCode, status: STATUS_AVAILABLE }
        }
    } catch (error) {
        return { status: STATUS_NOT_AVAILABLE }
    }
}

function getLocationInfo() {
    return new Promise((resolve, reject) => {
        let opts = {
            url: 'https://disney.api.edge.bamgrid.com/graph/v1/device/graphql',
            headers: {
                Authorization: 'ZGlzbmV5JmJyb3dzZXImMS4wLjA.Cu56AgSfBTDag5NiRA81oLHkDZfu5L3CKadnefEAY84',
                'Content-Type': 'application/json',
                'User-Agent': UA,
            },
            body: JSON.stringify({
                query: 'mutation registerDevice($input: RegisterDeviceInput!) { registerDevice(registerDevice: $input) { grant { grantType assertion } } }',
                variables: { input: { applicationRuntime: 'chrome', attributes: { browserName: 'chrome', browserVersion: '94.0.4606', manufacturer: 'apple', operatingSystem: 'macintosh' }, deviceFamily: 'browser', deviceLanguage: 'en', deviceProfile: 'macosx' } }
            })
        }
        $httpClient.post(opts, (error, response, data) => {
            if (error || response.status !== 200) return reject()
            let sdk = JSON.parse(data)?.extensions?.sdk
            resolve({ inSupportedLocation: sdk?.session?.inSupportedLocation, countryCode: sdk?.session?.location?.countryCode })
        })
    })
}
