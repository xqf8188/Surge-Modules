/*
 * 整合脚本：网络信息 (模块化布局)
 * 布局顺序：1. SSID/LAN -> 2. 流媒体解锁 -> 3. 落地 IP 详情
 */

const NAME = 'network-info-pro'
const $ = new Env(NAME)

// 参数初始化
let arg = (typeof $argument != 'undefined') ? Object.fromEntries($argument.split('&').map(item => item.split('='))) : {}
const REQUEST_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.61 Safari/537.36',
    'Accept-Language': 'zh-CN,zh;q=0.9',
}

!(async () => {
  // --- 1. 顶部：基础网络信息 ---
  let SSID = '', LAN = ''
  if (typeof $network !== 'undefined') {
    const v4 = $.lodash_get($network, 'v4.primaryAddress')
    if (arg.SSID == 1) SSID = `SSID: ${$.lodash_get($network, 'wifi.ssid') || '蜂窝网络'}`
    if (v4 && arg.LAN == 1) LAN = `内网 IP: ${v4}`
  }
  let top_part = [SSID, LAN].filter(i => i).join('  |  ')
  if (top_part) top_part += '\n' + '—'.repeat(20) + '\n'

  // --- 2. 中部：流媒体检测 ---
  const [yt, nf, gpt, disney] = await Promise.all([
    check_youtube(),
    check_netflix(),
    check_chatgpt(),
    check_disney()
  ])
  let media_part = [yt, nf, gpt, disney].join('\n') + '\n' + '—'.repeat(20)

  // --- 3. 下部：落地 IP 详细地理位置 ---
  const proxyData = await getFullProxyInfo()
  let bottom_part = `\n${proxyData}`

  // 组装最终内容
  const final_content = `${top_part}${media_part}${bottom_part}\n\n执行时间: ${new Date().toTimeString().split(' ')[0]}`

  if (isPanel()) {
    $.done({
      title: '网络插件 & 流媒体检测',
      content: final_content,
      icon: 'network',
      'icon-color': '#5AC8FA'
    })
  } else {
    $.msg('网络信息', '', final_content)
    $.done()
  }
})().catch(e => { $.logErr(e); $.done() })

// ================= 检测函数 =================

async function check_chatgpt() {
  return new Promise((res) => {
    $httpClient.get({url: 'https://chat.openai.com/cdn-cgi/trace', headers: REQUEST_HEADERS}, (err, resp, data) => {
      let reg = (data && data.match(/loc=([A-Z]{2})/)) ? data.match(/loc=([A-Z]{2})/)[1] : '??'
      $httpClient.get({url: 'https://ios.chat.openai.com/public-api/mobile/server_status/v1', headers: REQUEST_HEADERS}, (e, r, d) => {
        if (r && r.status === 200) res(`ChatGPT: 已解锁 ➟ ${reg}`)
        else res('ChatGPT: 不支持 🚫')
      })
    })
  })
}

async function check_youtube() {
  return new Promise((res) => {
    $httpClient.get({url: 'https://www.youtube.com/premium', headers: REQUEST_HEADERS}, (err, resp, data) => {
      if (err || resp.status !== 200) return res('YouTube: 检测失败')
      let m = data.match(/"countryCode":"(.*?)"/)
      let reg = m ? m[1] : 'US'
      res(`YouTube: 已解锁 ➟ ${reg}`)
    })
  })
}

async function check_netflix() {
  return new Promise((res) => {
    $httpClient.get({url: 'https://www.netflix.com/title/81280792', headers: REQUEST_HEADERS}, (err, resp) => {
      if (resp && resp.status === 200) res('Netflix: 已解锁 ➟ Full')
      else res('Netflix: 仅限自制剧 ➟ Limited')
    })
  })
}

async function check_disney() {
  return new Promise((res) => {
    $httpClient.get({url: 'https://www.disneyplus.com/', headers: REQUEST_HEADERS}, (err, resp, data) => {
      if (resp && resp.status === 200) res('Disney+: 已解锁 ➟ Yes')
      else res('Disney+: 未支持 🚫')
    })
  })
}

async function getFullProxyInfo() {
  return new Promise((res) => {
    $httpClient.get({url: 'http://ip-api.com/json/?lang=zh-CN', headers: REQUEST_HEADERS}, (err, resp, data) => {
      if (err || !data) return res('无法获取落地信息')
      let obj = JSON.parse(data)
      let flag = obj.countryCode.toUpperCase().replace(/./g, char => String.fromCodePoint(char.charCodeAt(0) + 127397))
      res(`落地 IP: ${obj.query}\n位置: ${flag} ${obj.country} · ${obj.regionName}\n运营商: ${obj.isp}`)
    })
  })
}

// 基础逻辑
function isPanel() { return typeof $input != 'undefined' && $input.purpose === 'panel' }
function Env(t,e){return new class{constructor(t,e){this.name=t,Object.assign(this,e)}logErr(t){console.log(`❗️${this.name} Error: ${t}`)}lodash_get(t,e,s){const a=e.replace(/\[(\d+)\]/g,".$1").split(".");let r=t;for(const t of a)if(r=Object(r)[t],void 0===r)return s;return r}done(t={}){$done(t)}}(t,e)}
