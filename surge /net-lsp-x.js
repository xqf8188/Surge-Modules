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

if (typeof $environment !== 'undefined' && $.lodash_get($environment, 'executor') === 'event-network') {
  $.lodash_set(arg, 'TYPE', 'EVENT')
}

if (!isInteraction() && !isRequest() && !isTile() && !isPanel()) {
  $.lodash_set(arg, 'TYPE', 'EVENT')
}

if (isRequest()) {
  arg = { ...arg, ...parseQueryString($request.url) }
}

const keya = 'spe', keyb = 'ge', keyc = 'pin', keyd = 'gan', keye = 'pi', keyf = 'ob', bay = 'edtest'

let result = {}
let proxy_policy = ''
let title = ''
let content = ''

!(async () => {
  if ($.lodash_get(arg, 'TYPE') === 'EVENT') {
    const eventDelay = parseFloat($.lodash_get(arg, 'EVENT_DELAY') || 3)
    if (eventDelay) await $.wait(1000 * eventDelay)
  }
  
  if (isTile()) await notify('网络信息', '面板', '开始查询')

  let SSID = '', LAN = '', LAN_IPv4 = '', LAN_IPv6 = ''
  // ... [此处保留你原有的网络环境获取逻辑] ...
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
  
  // 并发查询 IP 信息和流媒体信息
  let [
    { CN_IP = '', CN_INFO = '', CN_POLICY = '' } = {},
    { PROXY_IP = '', PROXY_INFO = '', PROXY_PRIVACY = '', PROXY_POLICY = '', ENTRANCE_IP = '' } = {},
    { CN_IPv6 = '' } = {},
    { PROXY_IPv6 = '' } = {},
    streamingRes = ''
  ] = await Promise.all([
    getDirectRequestInfo({ PROXIES }),
    getProxyRequestInfo({ PROXIES }),
    $.lodash_get(arg, 'IPv6') == 1 ? getDirectInfoIPv6() : Promise.resolve({}),
    $.lodash_get(arg, 'IPv6') == 1 ? getProxyInfoIPv6() : Promise.resolve({}),
    checkStreaming() // 新增流媒体检测
  ])

  let continueFlag = true
  // ... [此处保留你原有的变更对比逻辑] ...

  if (continueFlag) {
    let ENTRANCE = ''
    // ... [此处保留你原有的 ENTRANCE 逻辑] ...
    if (ENTRANCE_IP && ENTRANCE_IP !== PROXY_IP) {
       // 此处省略你原有的入口解析代码，保持不变即可
    }

    // 格式化输出
    if (CN_IPv6 && isIPv6(CN_IPv6)) CN_IPv6 = `\n${maskIP(CN_IPv6)}`; else CN_IPv6 = ''
    if (PROXY_IPv6 && isIPv6(PROXY_IPv6)) PROXY_IPv6 = `\n${maskIP(PROXY_IPv6)}`; else PROXY_IPv6 = ''
    
    const policy_prefix = $.isQuanX() || $.isLoon() ? '节点: ' : '代理策略: '
    proxy_policy = PROXY_POLICY ? `${policy_prefix}${maskAddr(PROXY_POLICY)}` : ''
    
    title = proxy_policy || '网络信息 𝕏'
    
    // 组装最终正文
    content = `${SSID}${LAN}${CN_POLICY}IP: ${maskIP(CN_IP) || '-'}${CN_IPv6}${maskAddr(CN_INFO ? `\n${CN_INFO}` : '')}\n\n` +
              `${ENTRANCE}落地 IP: ${maskIP(PROXY_IP) || '-'}${PROXY_IPv6}${maskAddr(PROXY_INFO ? `\n${PROXY_INFO}` : '')}${PROXY_PRIVACY}\n` +
              `📺 解锁: ${streamingRes}` // 在这里插入流媒体

    if (!isInteraction()) content += `\n执行时间: ${new Date().toTimeString().split(' ')[0]}`

    // 最后的显示通知逻辑保持不变
    if (isTile()) await notify('网络信息', '面板', '查询完成')
    else if (!isPanel()) {
       await notify('网络信息 𝕏', title, content)
    }
  }
})().catch(e => {
  $.logErr(e); notify('网络信息 𝕏', '❌', e.message || e)
}).finally(() => {
    // 保留原有的 Interaction / Request 结尾逻辑
    if (isInteraction()) {
      const html = `<div style="font-family: -apple-system; font-size: large">${`\n${content}${proxy_policy ? `\n\n${proxy_policy}` : ''}`.replace(/\n/g, '<br/>')}</div>`
      $.done({ title: '网络信息 𝕏', htmlMessage: html })
    } else $.done(result)
})

// --- 新增流媒体检测函数 ---
async function checkStreaming() {
  const opt = getNodeOpt();
  const results = await Promise.all([
    checkChatGPT(opt),
    checkYouTube(opt),
    checkNetflix(opt),
    checkDisney(opt)
  ]);
  return results.join(' | ');
}

async function checkChatGPT(opt) {
  try {
    const res = await $.http.get({ ...opt, url: 'https://ios.chat.openai.com/public-api/cpms-check', timeout: 3000 });
    return res.status === 200 ? 'GPT: ✅' : 'GPT: ❌';
  } catch (e) { return 'GPT: ⚠️'; }
}

async function checkYouTube(opt) {
  try {
    const res = await $.http.get({ ...opt, url: 'https://www.youtube.com/premium', timeout: 3000 });
    if (res.status !== 200) return 'YT: ❌';
    return res.body.includes('Premium is not available') ? 'YT: 🚫' : 'YT: ✅';
  } catch (e) { return 'YT: ⚠️'; }
}

async function checkNetflix(opt) {
  try {
    const res = await $.http.get({ ...opt, url: 'https://www.netflix.com/title/81215561', timeout: 3000 });
    if (res.status === 200) return 'NF: 完整';
    if (res.status === 404) return 'NF: 自制';
    return 'NF: ❌';
  } catch (e) { return 'NF: ⚠️'; }
}

async function checkDisney(opt) {
  try {
    const res = await $.http.get({ ...opt, url: 'https://www.disneyplus.com', timeout: 3000 });
    return res.status === 200 ? 'DP: ✅' : 'DP: ❌';
  } catch (e) { return 'DP: ⚠️'; }
}

// ... [保留后续所有原有辅助函数，如 getDirectInfo, getProxies, Env 等] ...
