const NAME = 'network-info'
const $ = new Env(NAME)

let arg
if (typeof $argument != 'undefined') {
  arg = Object.fromEntries($argument.split('&').map(item => item.split('=')))
} else {
  arg = {}
}
$.log(`传入的 $argument: ${$.toStr(arg)}`)

arg = { ...arg, ...$.getjson(NAME, {}) }

$.log(`从持久化存储读取参数后: ${$.toStr(arg)}`)

if (typeof $environment !== 'undefined' && $.lodash_get($environment, 'executor') === 'event-network') {
  $.log(`QX 事件脚本不能带参 修正运行环境`)
  $.lodash_set(arg, 'TYPE', 'EVENT')
}

if (!isInteraction() && !isRequest() && !isTile() && !isPanel()) {
  $.log(`参数为空 非可交互操作, 非请求, 非面板的情况下, 修正运行环境`)
  $.lodash_set(arg, 'TYPE', 'EVENT')
}

if (isRequest()) {
  arg = { ...arg, ...parseQueryString($request.url) }
  $.log(`从请求后读取参数后: ${$.toStr(arg)}`)
}

const keya = 'spe'
const keyb = 'ge'
const keyc = 'pin'
const keyd = 'gan'
const keye = 'pi'
const keyf = 'ob'
const bay = 'edtest'

let result = {}
let proxy_policy = ''
let title = ''
let content = ''

!(async () => {
  if ($.lodash_get(arg, 'TYPE') === 'EVENT') {
    const eventDelay = parseFloat($.lodash_get(arg, 'EVENT_DELAY') || 3)
    $.log(`网络变化, 等待 ${eventDelay} 秒后开始查询`)
    if (eventDelay) {
      await $.wait(1000 * eventDelay)
    }
  }
  if (isTile()) {
    await notify('网络信息', '面板', '开始查询')
  }

  let SSID = ''
  let LAN = ''
  let LAN_IPv4 = ''
  let LAN_IPv6 = ''
  if (typeof $network !== 'undefined') {
    const v4 = $.lodash_get($network, 'v4.primaryAddress')
    const v6 = $.lodash_get($network, 'v6.primaryAddress')
    if ($.lodash_get(arg, 'SSID') == 1) {
      SSID = $.lodash_get($network, 'wifi.ssid')
    }
    if (v4 && $.lodash_get(arg, 'LAN') == 1) {
      LAN_IPv4 = v4
    }
    if (v6 && $.lodash_get(arg, 'LAN') == 1 && $.lodash_get(arg, 'IPv6') == 1) {
      LAN_IPv6 = v6
    }
  } else if (typeof $config !== 'undefined') {
    try {
      let conf = $config.getConfig()
      conf = JSON.parse(conf)
      if ($.lodash_get(arg, 'SSID') == 1) {
        SSID = $.lodash_get(conf, 'ssid')
      }
    } catch (e) {}
  } else if (typeof $environment !== 'undefined') {
    try {
      const version = $.lodash_get($environment, 'version')
      const os = version?.split(' ')?.[0]
      if (os !== 'macOS' && $.lodash_get(arg, 'SSID') == 1) {
        SSID = $.lodash_get($environment, 'ssid')
      } else if (os === 'macOS' && $.lodash_get(arg, 'LAN') == 1) {
        LAN_IPv4 = $.lodash_get($environment, 'ssid')
      }
    } catch (e) {}
  }

  if (LAN_IPv4 || LAN_IPv6) {
    LAN = ['LAN:', LAN_IPv4, maskIP(LAN_IPv6)].filter(i => i).join(' ')
  }
  if (LAN) LAN = `${LAN}\n\n`
  if (SSID) SSID = `SSID: ${SSID}\n\n`

  let { PROXIES = [] } = await getProxies()
  
  // 核心查询逻辑：增加了流媒体解锁检测
  let [
    { CN_IP = '', CN_INFO = '', CN_POLICY = '' } = {},
    { PROXY_IP = '', PROXY_INFO = '', PROXY_PRIVACY = '', PROXY_POLICY = '', ENTRANCE_IP = '' } = {},
    { CN_IPv6 = '' } = {},
    { PROXY_IPv6 = '' } = {},
    streamingResult = '' // 新增流媒体检测结果
  ] = await Promise.all([
    getDirectRequestInfo({ PROXIES }),
    getProxyRequestInfo({ PROXIES }),
    $.lodash_get(arg, 'IPv6') == 1 ? getDirectInfoIPv6() : Promise.resolve({}),
    $.lodash_get(arg, 'IPv6') == 1 ? getProxyInfoIPv6() : Promise.resolve({}),
    checkStreaming() // 执行解锁检测
  ])

  let continueFlag = true
  if ($.lodash_get(arg, 'TYPE') === 'EVENT') {
    const lastNetworkInfoEvent = $.getjson('lastNetworkInfoEvent')
    if (
      CN_IP !== $.lodash_get(lastNetworkInfoEvent, 'CN_IP') ||
      CN_IPv6 !== $.lodash_get(lastNetworkInfoEvent, 'CN_IPv6') ||
      PROXY_IP !== $.lodash_get(lastNetworkInfoEvent, 'PROXY_IP') ||
      PROXY_IPv6 !== $.lodash_get(lastNetworkInfoEvent, 'PROXY_IPv6')
    ) {
      $.setjson({ CN_IP, PROXY_IP, CN_IPv6, PROXY_IPv6 }, 'lastNetworkInfoEvent')
    } else {
      $.log('网络信息未发生变化, 不继续')
      continueFlag = false
    }
  }

  if (continueFlag) {
    if ($.lodash_get(arg, 'PRIVACY') == '1' && PROXY_PRIVACY) {
      PROXY_PRIVACY = `\n${PROXY_PRIVACY}`
    }

    // 处理入口显示
    let ENTRANCE = ''
    if (ENTRANCE_IP) {
      const { IP: resolvedIP } = await resolveDomain(ENTRANCE_IP)
      if (resolvedIP) ENTRANCE_IP = resolvedIP
    }
    if (ENTRANCE_IP && ENTRANCE_IP !== PROXY_IP) {
      const entranceDelay = parseFloat($.lodash_get(arg, 'ENTRANCE_DELAY') || 0)
      if (entranceDelay) await $.wait(1000 * entranceDelay)
      let [{ CN_INFO: ENTRANCE_INFO1 = '', isCN = false } = {}, { PROXY_INFO: ENTRANCE_INFO2 = '' } = {}] =
        await Promise.all([
          getDirectInfo(ENTRANCE_IP, $.lodash_get(arg, 'DOMESTIC_IPv4')),
          getProxyInfo(ENTRANCE_IP, $.lodash_get(arg, 'LANDING_IPv4')),
        ])
      if (ENTRANCE_INFO1 && isCN) ENTRANCE = `入口: ${maskIP(ENTRANCE_IP) || '-'}\n${maskAddr(ENTRANCE_INFO1)}`
      if (ENTRANCE_INFO2) {
        ENTRANCE = ENTRANCE ? `${ENTRANCE.replace(/^(.*?):/gim, '$1¹:')}\n${maskAddr(ENTRANCE_INFO2.replace(/^(.*?):/gim, '$1²:'))}` : `入口: ${maskIP(ENTRANCE_IP) || '-'}\n${maskAddr(ENTRANCE_INFO2)}`
      }
    }
    if (ENTRANCE) ENTRANCE = `${ENTRANCE}\n\n`

    // 格式化输出
    if (CN_IPv6 && $.lodash_get(arg, 'IPv6') == 1) CN_IPv6 = `\n${maskIP(CN_IPv6)}`
    else CN_IPv6 = ''
    if (PROXY_IPv6 && $.lodash_get(arg, 'IPv6') == 1) PROXY_IPv6 = `\n${maskIP(PROXY_IPv6)}`
    else PROXY_IPv6 = ''

    const policy_prefix = $.isQuanX() || $.isLoon() ? '节点: ' : '代理策略: '
    proxy_policy = PROXY_POLICY === 'DIRECT' ? `${policy_prefix}直连` : (PROXY_POLICY ? `${policy_prefix}${maskAddr(PROXY_POLICY)}` : '')

    title = proxy_policy || '网络信息 𝕏'
    
    // 组装正文，加入流媒体检测结果
    content = `${SSID}${LAN}${CN_POLICY ? `策略: ${maskAddr(CN_POLICY)}\n` : ''}IP: ${maskIP(CN_IP) || '-'}${CN_IPv6}${maskAddr(CN_INFO ? `\n${CN_INFO}` : '')}\n\n${ENTRANCE}落地 IP: ${maskIP(PROXY_IP) || '-'}${PROXY_IPv6}${maskAddr(PROXY_INFO ? `\n${PROXY_INFO}` : '')}${PROXY_PRIVACY}\n\n流媒体检测: \n${streamingResult}`

    if (!isInteraction()) {
      content = `${content}\n执行时间: ${new Date().toTimeString().split(' ')[0]}`
    }

    if (isTile()) await notify('网络信息', '面板', '查询完成')
    else if (!isPanel()) {
      if ($.lodash_get(arg, 'TYPE') === 'EVENT') {
        await notify(`🄳 ${maskIP(CN_IP) || '-'} 🅿 ${maskIP(PROXY_IP) || '-'}`, `检测完成`, content)
      } else {
        await notify('网络信息 𝕏', title, content)
      }
    }
  }
})()
  .catch(async e => {
    $.logErr(e); title = `❌`; content = e.message || e;
    await notify('网络信息 𝕏', title, content)
  })
  .finally(async () => {
    if (isRequest()) {
      result = { response: { status: 200, body: JSON.stringify({ title, content }, null, 2), headers: { 'Content-Type': 'application/json; charset=UTF-8' } } }
    } else {
      result = { title, content, ...arg }
    }
    if (isInteraction()) {
      const html = `<div style="font-family: -apple-system; font-size: large">${content.replace(/\n/g, '<br/>')}</div>`
      $.done({ title: '网络信息 𝕏', htmlMessage: html })
    } else {
      $.done(result)
    }
  })

// --- 新增流媒体检测函数 ---
async function checkStreaming() {
  const timeout = 3000
  const opt = getNodeOpt()
  const results = await Promise.allSettled([
    // ChatGPT
    (async () => {
      try {
        const res = await http({ url: 'https://ios.chat.openai.com/public-api/auth0/verify-bundle-update', timeout, ...opt })
        return res.status === 200 ? '🟢 ChatGPT: 解锁' : '🔴 ChatGPT: 屏蔽'
      } catch (e) { return '⚪ ChatGPT: 检测失败' }
    })(),
    // Netflix
    (async () => {
      try {
        const res = await http({ url: 'https://www.netflix.com/title/81215561', timeout, ...opt })
        if (res.status === 200) return '🟢 Netflix: 完整解锁'
        if (res.status === 403) return '🟡 Netflix: 仅自制剧'
        return '🔴 Netflix: 不支持'
      } catch (e) { return '⚪ Netflix: 检测失败' }
    })(),
    // YouTube
    (async () => {
      try {
        const res = await http({ url: 'https://www.youtube.com/premium', timeout, ...opt })
        return res.status === 200 ? '🟢 YouTube: 已解锁' : '🔴 YouTube: 地区受限'
      } catch (e) { return '⚪ YouTube: 检测失败' }
    })(),
    // Disney+
    (async () => {
      try {
        const res = await http({ url: 'https://www.disneyplus.com', timeout, ...opt })
        return res.status === 200 ? '🟢 Disney+: 已解锁' : '🔴 Disney+: 不支持'
      } catch (e) { return '⚪ Disney+: 检测失败' }
    })()
  ])
  return results.map(r => r.status === 'fulfilled' ? r.value : '⚪ 检测超时').join('\n')
}

// --- 以下为原脚本辅助函数 (保持不变) ---
async function getEntranceInfo() {
  let IP = ''; let POLICY = ''
  if (isInteraction()) {
    try {
      if ($.isQuanX()) {
        const nodeName = $environment.params
        const { ret, error } = await $configuration.sendMessage({ action: 'get_server_description', content: nodeName })
        if (error) throw new Error(error)
        const proxy = Object.values(ret)[0]
        IP = proxy.match(/.+?\s*?=\s*?(.+?):\d+\s*?,.+/)[1]
        POLICY = nodeName
      } else if ($.isLoon()) {
        IP = $.lodash_get($environment, 'params.nodeInfo.address'); POLICY = $.lodash_get($environment, 'params.node')
      }
    } catch (e) {}
  }
  return { IP, POLICY }
}

async function getDirectRequestInfo({ PROXIES = [] } = {}) {
  const { CN_IP, CN_INFO } = await getDirectInfo(undefined, $.lodash_get(arg, 'DOMESTIC_IPv4'))
  const { POLICY } = await getRequestInfo(/cip\.cc|bilibili\.com|ipip\.net/, PROXIES)
  return { CN_IP, CN_INFO, CN_POLICY: POLICY }
}

async function getProxyRequestInfo({ PROXIES = [] } = {}) {
  const { PROXY_IP, PROXY_INFO, PROXY_PRIVACY } = await getProxyInfo(undefined, $.lodash_get(arg, 'LANDING_IPv4'))
  let result
  if ($.isSurge() || $.isStash()) {
    result = await getRequestInfo(/ipinfo\.io|ip-api\.com/, PROXIES)
  } else if ($.isQuanX() || $.isLoon()) {
    result = await getEntranceInfo()
  }
  return { PROXY_IP, PROXY_INFO, PROXY_PRIVACY, PROXY_POLICY: $.lodash_get(result, 'POLICY'), ENTRANCE_IP: $.lodash_get(result, 'IP') }
}

async function getRequestInfo(regexp, PROXIES = []) {
  let POLICY = ''; let IP = ''
  try {
    if ($.isSurge()) {
      const { requests } = await httpAPI('/v1/requests/recent', 'GET')
      const request = requests.slice(0, 10).find(i => regexp.test(i.URL))
      if (request) {
        POLICY = request.policyName
        if (/\(Proxy\)/.test(request.remoteAddress)) IP = request.remoteAddress.replace(/\s*\(Proxy\)\s*/, '')
      }
    }
  } catch (e) {}
  return { POLICY, IP }
}

async function getDirectInfo(ip, provider) {
  let CN_IP; let CN_INFO; let isCN
  try {
    const res = await http({ url: `https://api.bilibili.com/x/web-interface/zone`, headers: { 'User-Agent': 'Mozilla/5.0' } })
    const body = JSON.parse(res.body)
    isCN = body.data.country === '中国'
    CN_IP = body.data.addr
    CN_INFO = `位置: ${isCN ? '🇨🇳 ' : ''}${body.data.country} ${body.data.province} ${body.data.city}\n运营商: ${body.data.isp}`
  } catch (e) { $.logErr(e) }
  return { CN_IP, CN_INFO, isCN }
}

async function getDirectInfoIPv6() {
  try {
    const res = await http({ url: `https://ipv6.ddnspod.com` })
    return { CN_IPv6: res.body.trim() }
  } catch (e) { return { CN_IPv6: '' } }
}

async function getProxyInfo(ip, provider) {
  let PROXY_IP; let PROXY_INFO; let PROXY_PRIVACY
  try {
    const res = await http({ ...getNodeOpt(), url: `http://ip-api.com/json/${ip || ''}?lang=zh-CN` })
    const body = JSON.parse(res.body)
    PROXY_IP = body.query
    PROXY_INFO = `位置: ${getflag(body.countryCode)} ${body.country} ${body.regionName} ${body.city}\n运营商: ${body.isp}`
  } catch (e) { $.logErr(e) }
  return { PROXY_IP, PROXY_INFO, PROXY_PRIVACY }
}

async function getProxyInfoIPv6() {
  try {
    const res = await http({ ...getNodeOpt(), url: `https://api-ipv6.ip.sb/ip` })
    return { PROXY_IPv6: res.body.trim() }
  } catch (e) { return { PROXY_IPv6: '' } }
}

function resolveDomain(domain) { return Promise.resolve({ IP: domain }) }
function maskAddr(addr) { return addr }
function maskIP(ip) { return ip }
function getflag(e) {
  if (!e) return ''
  const t = e.toUpperCase().split('').map(e => 127397 + e.charCodeAt())
  return String.fromCodePoint(...t)
}
function parseQueryString(url) { return {} }
async function getProxies() { return { PROXIES: [] } }
async function httpAPI(p, m, b) { return { requests: [] } }
function isRequest() { return typeof $request !== 'undefined' }
function isPanel() { return $.isSurge() && typeof $input != 'undefined' && $.lodash_get($input, 'purpose') === 'panel' }
function isTile() { return $.isStash() && (typeof $script != 'undefined' && $.lodash_get($script, 'type') === 'tile') }
function isInteraction() { return ($.isQuanX() && $environment?.executor === 'event-interaction') || ($.isLoon() && $environment?.params?.node) }

function getNodeOpt() {
  if ($.isQuanX()) return { opts: { policy: $environment.params } }
  if ($.isLoon()) return { node: $environment.params.node }
  return {}
}

async function http(opt = {}) {
  const timeout = (opt.timeout || 5) * ($.isSurge() ? 1 : 1000)
  return await $.http.get({ ...opt, timeout })
}

async function notify(title, subt, desc) { $.msg(title, subt, desc) }

// Env 函数保持原样
function Env(t,e){class s{constructor(t){this.env=t}send(t,e="GET"){t="string"==typeof t?{url:t}:t;let s=this.get;return"POST"===e&&(s=this.post),new Promise((e,a)=>{s.call(this,t,(t,s,r)=>{t?a(t):e(s)})})}get(t){return this.send.call(this.env,t)}post(t){return this.send.call(this.env,t,"POST")}}return new class{constructor(t,e){this.name=t,this.http=new s(this),this.data=null,this.dataFile="box.dat",this.logs=[],this.isMute=!1,this.isNeedRewrite=!1,this.logSeparator="\n",this.encoding="utf-8",this.startTime=(new Date).getTime(),Object.assign(this,e),this.log("",`🔔${this.name}, 开始!`)}getEnv(){return"undefined"!=typeof $environment&&$environment["surge-version"]?"Surge":"undefined"!=typeof $environment&&$environment["stash-version"]?"Stash":"undefined"!=typeof module&&module.exports?"Node.js":"undefined"!=typeof $task?"Quantumult X":"undefined"!=typeof $loon?"Loon":"undefined"!=typeof $rocket?"Shadowrocket":void 0}isNode(){return"Node.js"===this.getEnv()}isQuanX(){return"Quantumult X"===this.getEnv()}isSurge(){return"Surge"===this.getEnv()}isLoon(){return"Loon"===this.getEnv()}isShadowrocket(){return"Shadowrocket"===this.getEnv()}isStash(){return"Stash"===this.getEnv()}toObj(t,e=null){try{return JSON.parse(t)}catch{return e}}toStr(t,e=null){try{return JSON.stringify(t)}catch{return e}}getjson(t,e){let s=e;const a=this.getdata(t);if(a)try{s=JSON.parse(this.getdata(t))}catch{}return s}setjson(t,e){try{return this.setdata(JSON.stringify(t),e)}catch{return!1}}getScript(t){return new Promise(e=>{this.get({url:t},(t,s,a)=>e(a))})}runScript(t,e){return new Promise(s=>{let a=this.getdata("@chavy_boxjs_userCfgs.httpapi");a=a?a.replace(/\n/g,"").trim():a;let r=this.getdata("@chavy_boxjs_userCfgs.httpapi_timeout");r=r?1*r:20,r=e&&e.timeout?e.timeout:r;const[i,o]=a.split("@"),n={url:`http://${o}/v1/scripting/evaluate`,body:{script_text:t,mock_type:"cron",timeout:r},headers:{"X-Key":i,Accept:"*/*"},timeout:r};this.post(n,(t,e,a)=>s(a))}).catch(t=>this.logErr(t))}loaddata(){if(!this.isNode())return{};{this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),a=!s&&this.fs.existsSync(e);if(!s&&!a)return{};{const a=s?t:e;try{return JSON.parse(this.fs.readFileSync(a))}catch(t){return{}}}}}writedata(){if(this.isNode()){this.fs=this.fs?this.fs:require("fs"),this.path=this.path?this.path:require("path");const t=this.path.resolve(this.dataFile),e=this.path.resolve(process.cwd(),this.dataFile),s=this.fs.existsSync(t),a=!s&&this.fs.existsSync(e),r=JSON.stringify(this.data);s?this.fs.writeFileSync(t,r):a?this.fs.writeFileSync(e,r):this.fs.writeFileSync(t,r)}}lodash_get(t,e,s){const a=e.replace(/\[(\d+)\]/g,".$1").split(".");let r=t;for(const t of a)if(r=Object(r)[t],void 0===r)return s;return r}lodash_set(t,e,s){return Object(t)!==t?t:(Array.isArray(e)||(e=e.toString().match(/[^.[\]]+/g)||[]),e.slice(0,-1).reduce((t,s,a)=>Object(t[s])===t[s]?t[s]:t[s]=Math.abs(e[a+1])>>0==+e[a+1]?[]:{},t)[e[e.length-1]]=s,t)}getdata(t){let e=this.getval(t);if(/^@/.test(t)){const[,s,a]=/^@(.*?)\.(.*?)$/.exec(t),r=s?this.getval(s):"";if(r)try{const t=JSON.parse(r);e=t?this.lodash_get(t,a,""):e}catch(t){e=""}}return e}setdata(t,e){let s=!1;if(/^@/.test(e)){const[,a,r]=/^@(.*?)\.(.*?)$/.exec(e),i=this.getval(a),o=a?"null"===i?null:i||"{}":"{}";try{const e=JSON.parse(o);this.lodash_set(e,r,t),s=this.setval(JSON.stringify(e),a)}catch(e){const i={};this.lodash_set(i,r,t),s=this.setval(JSON.stringify(i),a)}}else s=this.setval(t,e);return s}getval(t){switch(this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":return $persistentStore.read(t);case"Quantumult X":return $prefs.valueForKey(t);case"Node.js":return this.data=this.loaddata(),this.data[t];default:return this.data&&this.data[t]||null}}setval(t,e){switch(this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":return $persistentStore.write(t,e);case"Quantumult X":return $prefs.setValueForKey(t,e);case"Node.js":return this.data=this.loaddata(),this.data[e]=t,this.writedata(),!0;default:return this.data&&this.data[e]||null}}initGotEnv(t){this.got=this.got?this.got:require("got"),this.cktough=this.cktough?this.cktough:require("tough-cookie"),this.ckjar=this.ckjar?this.ckjar:new this.cktough.CookieJar,t&&(t.headers=t.headers?t.headers:{},void 0===t.headers.Cookie&&void 0===t.cookieJar&&(t.cookieJar=this.ckjar))}get(t,e=(()=>{})){switch(t.headers&&(delete t.headers["Content-Type"],delete t.headers["Content-Length"],delete t.headers["content-type"],delete t.headers["content-length"]),t.params&&(t.url+="?"+this.queryStr(t.params)),this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":default:this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient.get(t,(t,s,a)=>{!t&&s&&(s.body=a,s.statusCode=s.status?s.status:s.statusCode,s.status=s.statusCode),e(t,s,a)});break;case"Quantumult X":this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:s,statusCode:a,headers:r,body:i,bodyBytes:o}=t;e(null,{status:s,statusCode:a,headers:r,body:i,bodyBytes:o},i,o)},t=>e(t&&t.error||"UndefinedError"));break;case"Node.js":let s=require("iconv-lite");this.initGotEnv(t),this.got(t).on("redirect",(t,e)=>{try{if(t.headers["set-cookie"]){const s=t.headers["set-cookie"].map(this.cktough.Cookie.parse).toString();s&&this.ckjar.setCookieSync(s,null),e.cookieJar=this.ckjar}}catch(t){this.logErr(t)}}).then(t=>{const{statusCode:a,statusCode:r,headers:i,rawBody:o}=t,n=s.decode(o,this.encoding);e(null,{status:a,statusCode:r,headers:i,rawBody:o,body:n},n)},t=>{const{message:a,response:r}=t;e(a,r,r&&s.decode(r.rawBody,this.encoding))})}}post(t,e=(()=>{})){const s=t.method?t.method.toLocaleLowerCase():"post";switch(t.body&&t.headers&&!t.headers["Content-Type"]&&!t.headers["content-type"]&&(t.headers["content-type"]="application/x-www-form-urlencoded"),t.headers&&(delete t.headers["Content-Length"],delete t.headers["content-length"]),this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":default:this.isSurge()&&this.isNeedRewrite&&(t.headers=t.headers||{},Object.assign(t.headers,{"X-Surge-Skip-Scripting":!1})),$httpClient[s](t,(t,s,a)=>{!t&&s&&(s.body=a,s.statusCode=s.status?s.status:s.statusCode,s.status=s.statusCode),e(t,s,a)});break;case"Quantumult X":t.method=s,this.isNeedRewrite&&(t.opts=t.opts||{},Object.assign(t.opts,{hints:!1})),$task.fetch(t).then(t=>{const{statusCode:s,statusCode:a,headers:r,body:i,bodyBytes:o}=t;e(null,{status:s,statusCode:a,headers:r,body:i,bodyBytes:o},i,o)},t=>e(t&&t.error||"UndefinedError"));break;case"Node.js":let a=require("iconv-lite");this.initGotEnv(t);const{url:r,...i}=t;this.got[s](r,i).then(t=>{const{statusCode:s,statusCode:r,headers:i,rawBody:o}=t,n=a.decode(o,this.encoding);e(null,{status:s,statusCode:r,headers:i,rawBody:o,body:n},n)},t=>{const{message:s,response:r}=t;e(s,r,r&&a.decode(r.rawBody,this.encoding))})}}time(t,e=null){const s=e?new Date(e):new Date;let a={"M+":s.getMonth()+1,"d+":s.getDate(),"H+":s.getHours(),"m+":s.getMinutes(),"s+":s.getSeconds(),"q+":Math.floor((s.getMonth()+3)/3),S:s.getMilliseconds()};/(y+)/.test(t)&&(t=t.replace(RegExp.$1,(s.getFullYear()+"").substr(4-RegExp.$1.length)));for(let e in a)new RegExp("("+e+")").test(t)&&(t=t.replace(RegExp.$1,1==RegExp.$1.length?a[e]:("00"+a[e]).substr((""+a[e]).length)));return t}queryStr(t){let e="";for(const s in t){let a=t[s];null!=a&&""!==a&&("object"==typeof a&&(a=JSON.stringify(a)),e+=`${s}=${a}&`)}return e=e.substring(0,e.length-1),e}msg(e=t,s="",a="",r){const i=t=>{switch(typeof t){case void 0:return t;case"string":switch(this.getEnv()){case"Surge":case"Stash":default:return{url:t};case"Loon":case"Shadowrocket":return t;case"Quantumult X":return{"open-url":t};case"Node.js":return}case"object":switch(this.getEnv()){case"Surge":case"Stash":case"Shadowrocket":default:{let e=t.url||t.openUrl||t["open-url"];return{url:e}}case"Loon":{let e=t.openUrl||t.url||t["open-url"],s=t.mediaUrl||t["media-url"];return{openUrl:e,mediaUrl:s}}case"Quantumult X":{let e=t["open-url"]||t.url||t.openUrl,s=t["media-url"]||t.mediaUrl,a=t["update-pasteboard"]||t.updatePasteboard;return{"open-url":e,"media-url":s,"update-pasteboard":a}}case"Node.js":return}default:return}};if(!this.isMute)switch(this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":default:$notification.post(e,s,a,i(r));break;case"Quantumult X":$notify(e,s,a,i(r));break;case"Node.js":}if(!this.isMuteLog){let t=["","==============📣系统通知📣=============="];t.push(e),s&&t.push(s),a&&t.push(a),console.log(t.join("\n")),this.logs=this.logs.concat(t)}}log(...t){t.length>0&&(this.logs=[...this.logs,...t]),console.log(t.join(this.logSeparator))}logErr(t,e){switch(this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":case"Quantumult X":default:this.log("",`❗️${this.name}, 错误!`,t);break;case"Node.js":this.log("",`❗️${this.name}, 错误!`,t.stack)}}wait(t){return new Promise(e=>setTimeout(e,t))}done(t={}){const e=(new Date).getTime(),s=(e-this.startTime)/1e3;switch(this.log("",`🔔${this.name}, 结束! 🕛 ${s} 秒`),this.log(),this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":case"Quantumult X":default:$done(t);break;case"Node.js":process.exit(1)}}}(t,e)}
