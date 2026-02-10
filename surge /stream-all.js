/*
 * 由@LucaLin233 & @Rabbit-Spec 编写
 * 整合功能：
 * 1. ChatGPT 解锁检测（支持显示地区代码）
 * 2. 详细代理策略/IP 落地信息（国旗、运营商、地理位置）
 * 更新日期：2026.02.10
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
    
    // 异步执行所有检测任务
    const [yt, nf, gpt, disney, proxy] = await Promise.all([
        check_youtube_premium(), 
        check_netflix(), 
        check_chatgpt(),
        testDisneyPlus(),
        get_proxy_info()
    ])

    // 格式化 Disney+ 显示文字
    let disney_text = "Disney+: "
    if (disney.status == 1) disney_text += "已解锁 ➟ " + disney.region.toUpperCase()
    else if (disney.status == 2) disney_text += "即将登陆 ➟ " + disney.region.toUpperCase()
    else disney_text += "未支持 🚫"

    // 组合流媒体内容
    let media_content = [yt, nf, gpt, disney_text].join('\n')
    
    // 组合最终面板内容：流媒体 + 分割线 + 代理详情
    panel_result['content'] = media_content + '\n' + '—'.repeat(22) + '\n' + proxy
    
    $done(panel_result)
})()

// --- 代理策略与落地 IP 信息 ---
async function get_proxy_info() {
    return new Promise((resolve) => {
        $httpClient.get({
            url: 'http://ip-api.com/json/?lang=zh-CN',
            headers: REQUEST_HEADERS
        }, function (error, response, data) {
            if (error || response.status !== 200) {
                resolve('代理策略: 获取失败 🛠️')
                return
            }
            let obj = JSON.parse(data)
            let flag = getFlagEmoji(obj.countryCode)
            let info = `代理策略: ${flag} ${obj.country}\n` +
                       `落地 IP: ${obj.query}\n` +
                       `位置: ${obj.regionName} ${obj.city}\n` +
                       `运营商: ${obj.isp}`
            resolve(info)
        })
    })
}

// 国家代码转国旗 (例如 US -> 🇺🇸)
function getFlagEmoji(countryCode) {
    if (!countryCode) return '🏳️'
    return countryCode.toUpperCase().replace(/./g, char => 
        String.fromCodePoint(char.charCodeAt(0) + 127397)
    )
}

// --- ChatGPT 检测 (支持地区代码) ---
async function check_chatgpt() {
    return new Promise((resolve) => {
        // 先通过 trace 获取 Cloudflare 节点位置
        $httpClient.get({url: 'https://chat.openai.com/cdn-cgi/trace', headers: REQUEST_HEADERS}, function (err, res, data) {
            let region = '未知'
            if (data) {
                let m = data.match(/loc=([A-Z]{2})/)
                if (m) region = m[1]
            }
            
            // 验证是否被 OpenAI 屏蔽
            $httpClient.get({url: 'https://ios.chat.openai.com/public-api/mobile/server_status/v1', headers: REQUEST_HEADERS}, function (e, r, d) {
                if (r && r.status === 200) resolve(`ChatGPT: 已解锁 ➟ ${region}`)
                else resolve('ChatGPT: 不支持解锁 🚫')
            })
        })
    })
}

// --- YouTube 检测 ---
async function check_youtube_premium() {
    return new Promise((resolve) => {
        $httpClient.get({url: 'https://www.youtube.com/premium', headers: REQUEST_HEADERS}, function (error, response, data) {
            if (error || response.status !== 200) { resolve('YouTube: 检测失败'); return }
            if (data.indexOf('not available in your country') !== -1) { resolve('YouTube: 不支持解锁'); return }
            let re = new RegExp('"countryCode":"(.*?)"', 'gm')
            let result = re.exec(data)
            let region = (result && result.length === 2) ? result[1] : (data.indexOf('www.google.cn') !== -1 ? 'CN' : 'US')
            resolve(`YouTube: 已解锁 ➟ ${region.toUpperCase()}`)
        })
    })
}

// --- Netflix 检测 ---
async function check_netflix() {
    let inner = (id) => new Promise((res, rej) => {
        $httpClient.get({url: 'https://www.netflix.com/title/' + id, headers: REQUEST_HEADERS}, (e, r, d) => {
            if (e || r.status === 403) rej()
            else if (r.status === 404) res('NF')
            else {
                let url = r.headers['x-originating-url'] || ''
                let region = url.split('/')[3]?.split('-')[0].toUpperCase() || 'US'
                res(region === 'TITLE' ? 'US' : region)
            }
        })
    })
    return inner(81280792).then(code => `Netflix: 已完整解锁 ➟ ${code}`)
        .catch(() => inner(80018499).then(code => `Netflix: 仅解锁自制剧 ➟ ${code}`))
        .catch(() => 'Netflix: 该节点不支持解锁')
}

// --- Disney+ 检测 ---
async function testDisneyPlus() {
    try {
        let homepage = await new Promise((res, rej) => {
            $httpClient.get({url: 'https://www.disneyplus.com/', headers: REQUEST_HEADERS}, (e, r, d) => {
                if (e || r.status !== 200 || (d && d.indexOf('not available') !== -1)) rej()
                let m = d ? d.match(/Region: ([A-Za-z]{2})/) : null
                res({ region: m ? m[1] : 'US' })
            })
        })
        return { region: homepage.region, status: 1 }
    } catch (e) { return { status: 0, region: '' } }
}
