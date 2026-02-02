/*
 * 流媒体解锁检测脚本 (含 ChatGPT)
 * 修改自 @LucaLin233 & @Rabbit-Spec
 * 更新日期：2024.06.01
 */

const REQUEST_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.61 Safari/537.36',
    'Accept-Language': 'en',
}

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.61 Safari/537.36'

;(async () => {
    let panel_result = {
        title: '流媒体解锁检测',
        content: '',
        icon: 'play.tv.fill',
        'icon-color': '#FF2D55',
    }

    // 并发运行所有检测任务
    const results = await Promise.all([
        check_chatgpt(),
        check_youtube_premium(),
        check_netflix(),
        testDisneyPlus()
    ])

    panel_result['content'] = results.join('\n')
    $done(panel_result)
})()

// --- ChatGPT 检测 ---
async function check_chatgpt() {
    return new Promise((resolve) => {
        let option = {
            url: 'https://ios.chat.openai.com/v1/sentinel/chat-requirements',
            headers: REQUEST_HEADERS,
            timeout: 5000
        }
        $httpClient.post(option, (error, response, data) => {
            let res = 'ChatGPT: '
            if (error) return resolve(res + '检测失败 ⚠️')
            if (response.status === 200) return resolve(res + '已解锁 ✅')
            if (response.status === 403) return resolve(res + '拒绝访问 (403) 🚫')
            resolve(res + '不支持该地区 ✖️')
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
                if (error) return reject()
                if (response.status === 403) return reject()
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
            return (code2 === 'NF') ? 'Netflix: 不支持' : 'Netflix: 仅自制剧 ➟ ' + code2
        }
        return 'Netflix: 已完整解锁 ➟ ' + code
    } catch (e) { return 'Netflix: 检测失败' }
}

// --- Disney+ 检测 ---
async function testDisneyPlus() {
    try {
        let info = await getLocationInfo()
        let res = 'Disney+: '
        if (info.inSupportedLocation) return res + '已解锁 ➟ ' + info.countryCode.toUpperCase()
        return res + '即将登陆 ➟ ' + info.countryCode.toUpperCase()
    } catch (e) {
        return 'Disney+: 未支持 🚫'
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
