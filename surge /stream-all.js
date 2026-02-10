/*
 * 整合脚本：网络信息 (IP/运营商/入口) + 流媒体检测 (ChatGPT/NF/YT/Disney)
 * 支持：Surge, Quantumult X, Loon, Stash
 */

const NAME = 'network-info-stream'
const $ = new Env(NAME)

// --- 参数初始化 ---
let arg = (typeof $argument != 'undefined') ? Object.fromEntries($argument.split('&').map(item => item.split('='))) : {}
const REQUEST_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.61 Safari/537.36',
    'Accept-Language': 'en',
}

let result = {}
let title = ''
let content = ''

!(async () => {
  // 1. 基础网络信息查询逻辑 (保留原脚本逻辑)
  let SSID = '', LAN = '', LAN_IPv4 = '', LAN_IPv6 = ''
  if (typeof $network !== 'undefined') {
    const v4 = $.lodash_get($network, 'v4.primaryAddress')
    const v6 = $.lodash_get($network, 'v6.primaryAddress')
    if (arg.SSID == 1) SSID = `SSID: ${$.lodash_get($network, 'wifi.ssid')}\n\n`
    if (v4 && arg.LAN == 1) LAN_IPv4 = v4
    if (v6 && arg.LAN == 1 && arg.IPv6 == 1) LAN_IPv6 = v6
  }
  if (LAN_IPv4 || LAN_IPv6) LAN = `LAN: ${LAN_IPv4} ${maskIP(LAN_IPv6)}`.trim() + '\n\n'

  // 2. 并发执行：流媒体检测 + IP 信息检测
  $.log("开始同步检测流媒体与网络信息...")
  const [yt, nf, gpt, disney, proxyData, directData] = await Promise.all([
    check_youtube_premium(),
    check_netflix(),
    check_chatgpt(),
    testDisneyPlus(),
    getProxyInfo(undefined, arg.LANDING_IPv4), // 落地信息
    getDirectInfo(undefined, arg.DOMESTIC_IPv4) // 直连信息
  ])

  // 3. 格式化流媒体部分
  let disney_text = "Disney+: "
  if (disney.status == 1) disney_text += "已解锁 ➟ " + disney.region.toUpperCase()
  else if (disney.status == 2) disney_text += "即将登陆 ➟ " + disney.region.toUpperCase()
  else disney_text += "未支持 🚫"

  const media_content = [yt, nf, gpt, disney_text].join('\n')

  // 4. 格式化 IP 信息部分 (落地 IP / 运营商)
  const PROXY_IP = proxyData.PROXY_IP || '-'
  const PROXY_INFO = proxyData.PROXY_INFO || ''
  const CN_IP = directData.CN_IP || '-'
  
  // 5. 组装最终面板
  title = `网络信息 & 流媒体`
  
  // 组装顺序：SSID/LAN -> 流媒体列表 -> 分割线 -> 代理/IP 详情
  content = `${SSID}${LAN}${media_content}\n` + 
            '—'.repeat(20) + '\n' +
            `节点: ${maskIP(PROXY_IP)}\n${PROXY_INFO}\n` +
            `直连: ${maskIP(CN_IP)}`

  if (!isInteraction()) {
    content += `\n执行时间: ${new Date().toTimeString().split(' ')[0]}`
  }

  // 6. 最终输出
  if (isPanel()) {
    $done({ title, content, icon: "network", "icon-color": "#5AC8FA" })
  } else {
    $.msg(title, "", content)
    $.done()
  }
})().catch(e => {
  $.logErr(e)
  $.done()
})

// ================= 流媒体检测函数库 =================

async function check_chatgpt() {
    return new Promise((resolve) => {
        $httpClient.get({url: 'https://chat.openai.com/cdn-cgi/trace', headers: REQUEST_HEADERS}, function (err, res, data) {
            let region = '未知'
            if (data) {
                let m = data.match(/loc=([A-Z]{2})/)
                if (m) region = m[1]
            }
            $httpClient.get({url: 'https://ios.chat.openai.com/public-api/mobile/server_status/v1', headers: REQUEST_HEADERS}, function (e, r, d) {
                if (r && r.status === 200) resolve(`ChatGPT: 已解锁 ➟ ${region}`)
                else resolve('ChatGPT: 不支持解锁 🚫')
            })
        })
    })
}

async function check_youtube_premium() {
    return new Promise((resolve) => {
        $httpClient.get({url: 'https://www.youtube.com/premium', headers: REQUEST_HEADERS}, function (error, response, data) {
            if (error || response.status !== 200) { resolve('YouTube: 检测失败'); return }
            if (data.indexOf('not available in your country') !== -1) { resolve('YouTube: 不支持解锁'); return }
            let re = new RegExp('"countryCode":"(.*?)"', 'gm')
            let result = re.exec(data)
            let region = (result && result.length === 2) ? result[1] : 'US'
            resolve(`YouTube: 已解锁 ➟ ${region.toUpperCase()}`)
        })
    })
}

async function check_netflix() {
    let inner = (id) => new Promise((res, rej) => {
        $httpClient.get({url: 'https://www.netflix.com/title/' + id, headers: REQUEST_HEADERS}, (e, r, d) => {
            if (e || r.status === 403) rej()
            else if (r.status === 404) res('NF')
            else res((r.headers['x-originating-url'] || '').split('/')[3]?.split('-')[0].toUpperCase() || 'US')
        })
    })
    return inner(81280792).then(code => `Netflix: 已完整解锁 ➟ ${code}`)
        .catch(() => inner(80018499).then(code => `Netflix: 仅解锁自制剧 ➟ ${code}`))
        .catch(() => 'Netflix: 该节点不支持解锁')
}

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

// ================= 网络信息函数库 (精简自原脚本) =================

async function getProxyInfo(ip, provider) {
    return new Promise((resolve) => {
        $httpClient.get({ url: 'http://ip-api.com/json?lang=zh-CN', headers: REQUEST_HEADERS }, function (error, response, data) {
            if (error) { resolve({}); return }
            let obj = JSON.parse(data)
            let flag = getflag(obj.countryCode)
            resolve({
                PROXY_IP: obj.query,
                PROXY_INFO: `位置: ${flag} ${obj.country} ${obj.regionName}\n运营商: ${obj.isp}`
            })
        })
    })
}

async function getDirectInfo(ip, provider) {
    return new Promise((resolve) => {
        $httpClient.get({ url: 'https://api.bilibili.com/x/web-interface/zone', headers: REQUEST_HEADERS }, function (error, response, data) {
            if (error) { resolve({}); return }
            let obj = JSON.parse(data)
            resolve({ CN_IP: obj.data.addr })
        })
    })
}

function maskIP(ip) {
  if (!ip || ip === '-') return ip
  return ip.split('.').slice(0, 2).join('.') + '.*.*'
}

function getflag(e) {
  if (!e) return ''
  return e.toUpperCase().replace(/./g, char => String.fromCodePoint(char.charCodeAt(0) + 127397))
}

function isPanel() { return typeof $input != 'undefined' && $input.purpose === 'panel' }
function isInteraction() { return false }

// --- Env 环境 (保留部分核心逻辑以保持兼容性) ---
function Env(t,e){class s{constructor(t){this.env=t}send(t,e="GET"){t="string"==typeof t?{url:t}:t;let s=this.get;return"POST"===e&&(s=this.post),new Promise((e,a)=>{s.call(this,t,(t,s,r)=>{t?a(t):e(s)})})}get(t){return this.send.call(this.env,t)}post(t){return this.send.call(this.env,t,"POST")}}return new class{constructor(t,e){this.name=t,this.http=new s(this),this.logs=[],this.startTime=(new Date).getTime(),Object.assign(this,e)}log(...t){console.log(t.join("\n"))}msg(e,s,a){$notification.post(e,s,a)}lodash_get(t,e,s){const a=e.replace(/\[(\d+)\]/g,".$1").split(".");let r=t;for(const t of a)if(r=Object(r)[t],void 0===r)return s;return r}done(t={}){$done(t)}}(t,e)}
