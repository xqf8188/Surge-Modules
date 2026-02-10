/*
 * 整合脚本：网络信息 (全显 IP + 策略名版)
 * 支持：Surge, Loon, Stash
 */

const NAME = 'network-info-proxy-name'
const $ = new Env(NAME)

// --- 参数初始化 ---
let arg = (typeof $argument != 'undefined') ? Object.fromEntries($argument.split('&').map(item => item.split('='))) : {}
const REQUEST_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.61 Safari/537.36',
    'Accept-Language': 'en',
}

!(async () => {
  // 1. 获取基础网络与策略信息
  let SSID = '', LAN = '', PROXY_NAME = ''
  
  if (typeof $network !== 'undefined') {
    const v4 = $.lodash_get($network, 'v4.primaryAddress')
    if (arg.SSID == 1) SSID = `SSID: ${$.lodash_get($network, 'wifi.ssid')}\n\n`
    if (v4 && arg.LAN == 1) LAN = `LAN: ${v4}\n\n`
  }

  // 获取当前选中的策略名 (Surge/Loon 支持)
  if (typeof $session !== 'undefined' && $session.proxy) {
    PROXY_NAME = `策略: ${$session.proxy}\n`
  }

  // 2. 并发执行检测
  const [yt, nf, gpt, disney, proxyData, directData] = await Promise.all([
    check_youtube_premium(),
    check_netflix(),
    check_chatgpt(),
    testDisneyPlus(),
    getProxyInfo(), 
    getDirectInfo()
  ])

  // 3. 组装内容
  const title = `网络信息 & 流媒体`
  const media_content = [yt, nf, gpt, disney].join('\n')
  
  const content = `${SSID}${LAN}${media_content}\n` + 
            '—'.repeat(20) + '\n' +
            `${PROXY_NAME}` +
            `节点: ${proxyData.ip}\n${proxyData.info}\n` +
            `直连: ${directData.ip}` +
            `\n执行时间: ${new Date().toTimeString().split(' ')[0]}`

  // 4. 最终输出
  if (typeof $input != 'undefined' && $input.purpose === 'panel') {
    $done({ title, content, icon: "network", "icon-color": "#5AC8FA" })
  } else {
    $.msg(title, "", content)
    $.done()
  }
})().catch(e => { $.logErr(e); $.done() })

// ================= 函数库 =================

async function check_chatgpt() {
    return new Promise((resolve) => {
        $httpClient.get({url: 'https://chat.openai.com/cdn-cgi/trace', headers: REQUEST_HEADERS}, (err, res, data) => {
            let reg = data?.match(/loc=([A-Z]{2})/)?.[1] || '未知'
            $httpClient.get({url: 'https://ios.chat.openai.com/public-api/mobile/server_status/v1', headers: REQUEST_HEADERS}, (e, r, d) => {
                resolve(`ChatGPT: ${r?.status === 200 ? '已解锁 ➟ ' + reg : '不支持解锁 🚫'}`)
            })
        })
    })
}

async function check_youtube_premium() {
    return new Promise((resolve) => {
        $httpClient.get({url: 'https://www.youtube.com/premium', headers: REQUEST_HEADERS}, (error, response, data) => {
            let m = data?.match(/"countryCode":"(.*?)"/)?.[1] || 'US'
            resolve(`YouTube: ${data?.indexOf('not available') === -1 ? '已解锁 ➟ ' + m : '不支持解锁'}`)
        })
    })
}

async function check_netflix() {
    let inner = (id) => new Promise((res, rej) => {
        $httpClient.get({url: 'https://www.netflix.com/title/' + id, headers: REQUEST_HEADERS}, (e, r, d) => {
            if (e || r.status === 403) rej()
            else res((r.headers['x-originating-url'] || '').split('/')[3]?.split('-')[0].toUpperCase() || 'US')
        })
    })
    return inner(81280792).then(c => `Netflix: 已完整解锁 ➟ ${c}`).catch(() => 'Netflix: 不支持解锁')
}

async function testDisneyPlus() {
    return new Promise((res) => {
        $httpClient.get({url: 'https://www.disneyplus.com/', headers: headers = REQUEST_HEADERS}, (e, r, d) => {
            let m = d?.match(/Region: ([A-Za-z]{2})/)?.[1] || 'US'
            res(`Disney+: ${(!e && r.status==200) ? '已解锁 ➟ ' + m : '未支持 🚫'}`)
        })
    })
}

async function getProxyInfo() {
    return new Promise((res) => {
        $httpClient.get({ url: 'http://ip-api.com/json?lang=zh-CN', headers: REQUEST_HEADERS }, (err, resp, data) => {
            if (err) return res({ ip: '-', info: '' })
            let obj = JSON.parse(data)
            let flag = obj.countryCode.toUpperCase().replace(/./g, c => String.fromCodePoint(c.charCodeAt(0) + 127397))
            res({ ip: obj.query, info: `位置: ${flag} ${obj.country} ${obj.regionName}\n运营商: ${obj.isp}` })
        })
    })
}

async function getDirectInfo() {
    return new Promise((res) => {
        $httpClient.get({ url: 'https://api.bilibili.com/x/web-interface/zone', headers: REQUEST_HEADERS }, (err, resp, data) => {
            res({ ip: JSON.parse(data || '{}')?.data?.addr || '-' })
        })
    })
}

function Env(t,e){class s{constructor(t){this.env=t}send(t,e="GET"){t="string"==typeof t?{url:t}:t;let s=this.get;return"POST"===e&&(s=this.post),new Promise((e,a)=>{s.call(this,t,(t,s,r)=>{t?a(t):e(s)})})}get(t){return this.send.call(this.env,t)}post(t){return this.send.call(this.env,t,"POST")}}return new class{constructor(t,e){this.name=t,this.http=new s(this),this.logs=[],Object.assign(this,e)}log(...t){console.log(t.join("\n"))}msg(e,s,a){$notification.post(e,s,a)}lodash_get(t,e,s){const a=e.replace(/\[(\d+)\]/g,".$1").split(".");let r=t;for(const t of a)if(r=Object(r)[t],void 0===r)return s;return r}done(t={}){$done(t)}}(t,e)}
