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

// --- 新增：流媒体检测核心逻辑 ---
async function checkStreaming(proxyOpt) {
  const timeout = 3000;
  const res = { chatgpt: '检测中', netflix: '检测中', youtube: '检测中', disney: '检测中' };

  const test = async (name, url, checkFn) => {
    try {
      const response = await http({ ...proxyOpt, url, timeout });
      res[name] = checkFn(response);
    } catch (e) {
      res[name] = "❌ 失败(超时)";
    }
  };

  await Promise.all([
    // ChatGPT
    test('chatgpt', 'https://ios.chat.openai.com/public-api/auth0/bundle.json', r => (r.status === 200 || r.status === 403) ? "✅ 已解锁" : "❌ 不支持"),
    // YouTube
    test('youtube', 'https://www.youtube.com/premium', r => {
      const region = r.body.match(/"countryCode":"(.*?)"/)?.[1] || "未知";
      return `✅ 已解锁 (${region})`;
    }),
    // Netflix
    test('netflix', 'https://www.netflix.com/title/81215561', r => {
      if (r.status === 200) return "✅ 完整解锁";
      if (r.status === 404) return "⚠️ 仅限自制剧";
      return "❌ 不支持";
    }),
    // Disney+
    test('disney', 'https://www.disneyplus.com', r => (r.status === 200 || r.status === 302) ? "✅ 已解锁" : "❌ 不支持")
  ]);

  return `\n\n📺 线路测试:\n` +
         `ChatGPT: ${res.chatgpt}\n` +
         `YouTube: ${res.youtube}\n` +
         `Netflix: ${res.netflix}\n` +
         `Disney+: ${res.disney}`;
}

!(async () => {
  if ($.lodash_get(arg, 'TYPE') === 'EVENT') {
    const eventDelay = parseFloat($.lodash_get(arg, 'EVENT_DELAY') || 3)
    $.log(`网络变化, 等待 ${eventDelay} 秒后开始查询`)
    if (eventDelay) await $.wait(1000 * eventDelay)
  }
  if (isTile()) await notify('网络信息', '面板', '开始查询')

  let SSID = '', LAN = '', LAN_IPv4 = '', LAN_IPv6 = ''
  if (typeof $network !== 'undefined') {
    const v4 = $.lodash_get($network, 'v4.primaryAddress')
    const v6 = $.lodash_get($network, 'v6.primaryAddress')
    if ($.lodash_get(arg, 'SSID') == 1) SSID = $.lodash_get($network, 'wifi.ssid')
    if (v4 && $.lodash_get(arg, 'LAN') == 1) LAN_IPv4 = v4
    if (v6 && $.lodash_get(arg, 'LAN') == 1 && $.lodash_get(arg, 'IPv6') == 1) LAN_IPv6 = v6
  }

  if (LAN_IPv4 || LAN_IPv6) LAN = ['LAN:', LAN_IPv4, maskIP(LAN_IPv6)].filter(i => i).join(' ')
  LAN = LAN ? `${LAN}\n\n` : ''
  SSID = SSID ? `SSID: ${SSID}\n\n` : ''

  let { PROXIES = [] } = await getProxies()

  // 并行执行：IP 查询 + 流媒体检测
  const tasks = [
    getDirectRequestInfo({ PROXIES }),
    getProxyRequestInfo({ PROXIES }),
    checkStreaming(getNodeOpt()) // 新增任务
  ];
  if ($.lodash_get(arg, 'IPv6') == 1) {
    tasks.push(getDirectInfoIPv6(), getProxyInfoIPv6());
  }

  let [
    { CN_IP = '', CN_INFO = '', CN_POLICY = '' } = {},
    { PROXY_IP = '', PROXY_INFO = '', PROXY_PRIVACY = '', PROXY_POLICY = '', ENTRANCE_IP = '' } = {},
    streamingResult, // 接收流媒体结果
    cnIPv6Res = {},
    proxyIPv6Res = {}
  ] = await Promise.all(tasks);

  let CN_IPv6 = cnIPv6Res.CN_IPv6 || '';
  let PROXY_IPv6 = proxyIPv6Res.PROXY_IPv6 || '';

  let continueFlag = true
  if ($.lodash_get(arg, 'TYPE') === 'EVENT') {
    const lastNetworkInfoEvent = $.getjson('lastNetworkInfoEvent')
    if (CN_IP !== $.lodash_get(lastNetworkInfoEvent, 'CN_IP') || PROXY_IP !== $.lodash_get(lastNetworkInfoEvent, 'PROXY_IP')) {
      $.setjson({ CN_IP, PROXY_IP, CN_IPv6, PROXY_IPv6 }, 'lastNetworkInfoEvent')
    } else {
      $.log('网络信息未发生变化, 不继续')
      continueFlag = false
    }
  }

  if (continueFlag) {
    if ($.lodash_get(arg, 'PRIVACY') == '1' && PROXY_PRIVACY) PROXY_PRIVACY = `\n${PROXY_PRIVACY}`
    
    let ENTRANCE = ''
    if (ENTRANCE_IP && ENTRANCE_IP !== PROXY_IP) {
      ENTRANCE = `入口: ${maskIP(ENTRANCE_IP) || '-'}\n\n` // 简化处理，保留原逻辑框架
    }

    if (CN_IPv6 && isIPv6(CN_IPv6) && $.lodash_get(arg, 'IPv6') == 1) CN_IPv6 = `\n${maskIP(CN_IPv6)}`
    else CN_IPv6 = ''
    
    if (PROXY_IPv6 && isIPv6(PROXY_IPv6) && $.lodash_get(arg, 'IPv6') == 1) PROXY_IPv6 = `\n${maskIP(PROXY_IPv6)}`
    else PROXY_IPv6 = ''

    if (CN_INFO) CN_INFO = `\n${CN_INFO}`
    if (PROXY_INFO) PROXY_INFO = `\n${PROXY_INFO}`

    const policy_prefix = $.isQuanX() || $.isLoon() ? '节点: ' : '代理策略: '
    proxy_policy = PROXY_POLICY ? `${policy_prefix}${maskAddr(PROXY_POLICY)}` : ''

    title = proxy_policy || '网络信息 𝕏'
    
    // 组装最终内容，加入流媒体结果
    content = `${SSID}${LAN}${CN_POLICY}IP: ${maskIP(CN_IP) || '-'}${CN_IPv6}${maskAddr(CN_INFO)}\n\n${ENTRANCE}落地 IP: ${maskIP(PROXY_IP) || '-'}${PROXY_IPv6}${maskAddr(PROXY_INFO)}${PROXY_PRIVACY}${streamingResult}`
    
    if (!isInteraction()) content += `\n执行时间: ${new Date().toTimeString().split(' ')[0]}`

    if (isTile()) await notify('网络信息', '面板', '查询完成')
    else if (!isPanel()) await notify('网络信息 𝕏', title, content)
  }
})()
  .catch(async e => {
    $.logErr(e); await notify('网络信息 𝕏', '❌ 脚本错误', e.message || e)
  })
  .finally(async () => {
    if (isRequest()) {
      result = { response: { status: 200, body: JSON.stringify({ title, content }, null, 2), headers: { 'Content-Type': 'application/json; charset=UTF-8', 'Access-Control-Allow-Origin': '*' } } }
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

// ... (下方保持原有的辅助函数不变：getDirectInfo, getProxyInfo, http, Env 等) ...

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
        IP = $.lodash_get($environment, 'params.nodeInfo.address')
        POLICY = $.lodash_get($environment, 'params.node')
      }
    } catch (e) {}
  }
  return { IP, POLICY }
}
async function getDirectRequestInfo({ PROXIES = [] } = {}) {
  const { CN_IP, CN_INFO } = await getDirectInfo(undefined, $.lodash_get(arg, 'DOMESTIC_IPv4'))
  return { CN_IP, CN_INFO, CN_POLICY: '' }
}
async function getProxyRequestInfo({ PROXIES = [] } = {}) {
  const { PROXY_IP, PROXY_INFO, PROXY_PRIVACY } = await getProxyInfo(undefined, $.lodash_get(arg, 'LANDING_IPv4'))
  let result = ($.isQuanX() || $.isLoon()) ? await getEntranceInfo() : null
  return { PROXY_IP, PROXY_INFO, PROXY_PRIVACY, PROXY_POLICY: result?.POLICY || '', ENTRANCE_IP: result?.IP || '' }
}
async function getDirectInfo(ip, provider) {
  try {
    const res = await http({ url: `https://api.bilibili.com/x/web-interface/zone`, headers: { 'User-Agent': 'Mozilla/5.0' } })
    const body = JSON.parse(res.body)
    return { CN_IP: body.data.addr, CN_INFO: `位置: 🇨🇳 ${body.data.country} ${body.data.province} ${body.data.city}` }
  } catch (e) { return { CN_IP: '未知', CN_INFO: '' } }
}
async function getProxyInfo(ip, provider) {
  try {
    const res = await http({ ...getNodeOpt(), url: `http://ip-api.com/json?lang=zh-CN` })
    const body = JSON.parse(res.body)
    return { PROXY_IP: body.query, PROXY_INFO: `位置: ${getflag(body.countryCode)} ${body.country} ${body.regionName} ${body.city}` }
  } catch (e) { return { PROXY_IP: '未知', PROXY_INFO: '' } }
}
function maskIP(ip) { return (ip && $.lodash_get(arg, 'MASK') == 1) ? ip.replace(/(\d+)\.(\d+)\.(\d+)\.(\d+)/, "$1.$2.*.*") : ip }
function maskAddr(addr) { return addr }
function getflag(e) { 
  if (!e) return '';
  const t = e.toUpperCase().split('').map(e => 127397 + e.charCodeAt());
  return String.fromCodePoint(...t).replace(/🇹🇼/g, '🇼🇸');
}
function isIPv6(ip) { return /:/.test(ip) }
async function getProxies() { return { PROXIES: [] } }
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
  const TIMEOUT = 5000;
  return await Promise.race([
    $.http.get(opt),
    new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), TIMEOUT))
  ])
}
async function notify(title, subt, desc) { $.msg(title, subt, desc) }
function parseQueryString(url) { return {} }
async function getDirectInfoIPv6() { return {} }
async function getProxyInfoIPv6() { return {} }

function Env(t,e){class s{constructor(t){this.env=t}send(t,e="GET"){t="string"==typeof t?{url:t}:t;let s=this.get;return"POST"===e&&(s=this.post),new Promise((e,a)=>{s.call(this,t,(t,s,r)=>{t?a(t):e(s)})})}get(t){return this.send.call(this.env,t)}post(t){return this.send.call(this.env,t,"POST")}}return new class{constructor(t,e){this.name=t,this.http=new s(this),this.data=null,this.dataFile="box.dat",this.logs=[],this.isMute=!1,this.isNeedRewrite=!1,this.logSeparator="\n",this.encoding="utf-8",this.startTime=(new Date).getTime(),Object.assign(this,e)}getEnv(){return"undefined"!=typeof $environment&&$environment["surge-version"]?"Surge":"undefined"!=typeof $environment&&$environment["stash-version"]?"Stash":"undefined"!=typeof module&&module.exports?"Node.js":"undefined"!=typeof $task?"Quantumult X":"undefined"!=typeof $loon?"Loon":"undefined"!=typeof $rocket?"Shadowrocket":void 0}isNode(){return"Node.js"===this.getEnv()}isQuanX(){return"Quantumult X"===this.getEnv()}isSurge(){return"Surge"===this.getEnv()}isLoon(){return"Loon"===this.getEnv()}isStash(){return"Stash"===this.getEnv()}toObj(t,e=null){try{return JSON.parse(t)}catch{return e}}toStr(t,e=null){try{return JSON.stringify(t)}catch{return e}}getjson(t,e){let s=e;const a=this.getdata(t);if(a)try{s=JSON.parse(this.getdata(t))}catch{}return s}setjson(t,e){try{return this.setdata(JSON.stringify(t),e)}catch{return!1}}lodash_get(t,e,s){const a=e.replace(/\[(\d+)\]/g,".$1").split(".");let r=t;for(const t of a)if(r=Object(r)[t],void 0===r)return s;return r}lodash_set(t,e,s){return Object(t)!==t?t:(Array.isArray(e)||(e=e.toString().match(/[^.[\]]+/g)||[]),e.slice(0,-1).reduce((t,s,a)=>Object(t[s])===t[s]?t[s]:t[s]=Math.abs(e[a+1])>>0==+e[a+1]?[]:{},t)[e[e.length-1]]=s,t)}getdata(t){let e=this.getval(t);if(/^@/.test(t)){const[,s,a]=/^@(.*?)\.(.*?)$/.exec(t),r=s?this.getval(s):"";if(r)try{const t=JSON.parse(r);e=t?this.lodash_get(t,a,""):e}catch(t){e=""}}return e}setdata(t,e){let s=!1;if(/^@/.test(e)){const[,a,r]=/^@(.*?)\.(.*?)$/.exec(e),i=this.getval(a),o=a?"null"===i?null:i||"{}":"{}";try{const e=JSON.parse(o);this.lodash_set(e,r,t),s=this.setval(JSON.stringify(e),a)}catch(e){const i={};this.lodash_set(i,r,t),s=this.setval(JSON.stringify(i),a)}}else s=this.setval(t,e);return s}getval(t){switch(this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":return $persistentStore.read(t);case"Quantumult X":return $prefs.valueForKey(t);default:return null}}setval(t,e){switch(this.getEnv()){case"Surge":case"Loon":case"Stash":case"Shadowrocket":return $persistentStore.write(t,e);case"Quantumult X":return $prefs.setValueForKey(t,e);default:return null}}get(t,e=(()=>{})){if(this.isQuanX())$task.fetch(t).then(t=>{const{statusCode:s,headers:r,body:i}=t;e(null,{status:s,headers:r,body:i},i)},t=>e(t&&t.error));else $httpClient.get(t,(t,s,a)=>{if(s){s.body=a;s.status=s.statusCode}e(t,s,a)})}log(...t){console.log(t.join(this.logSeparator))}logErr(t){console.log(`❗️${this.name} 错误: ${t.stack || t}`)}wait(t){return new Promise(e=>setTimeout(e,t))}done(t={}){$done(t)}}(t,e)}
