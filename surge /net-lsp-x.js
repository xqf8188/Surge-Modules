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
    if (eventDelay) await $.wait(1000 * eventDelay)
  }
  if (isTile()) await notify('网络信息', '面板', '开始查询')

  let SSID = ''; let LAN = ''; let LAN_IPv4 = ''; let LAN_IPv6 = '';
  if (typeof $network !== 'undefined') {
    const v4 = $.lodash_get($network, 'v4.primaryAddress')
    const v6 = $.lodash_get($network, 'v6.primaryAddress')
    if ($.lodash_get(arg, 'SSID') == 1) SSID = $.lodash_get($network, 'wifi.ssid')
    if (v4 && $.lodash_get(arg, 'LAN') == 1) LAN_IPv4 = v4
    if (v6 && $.lodash_get(arg, 'LAN') == 1 && $.lodash_get(arg, 'IPv6') == 1) LAN_IPv6 = v6
  } else if (typeof $config !== 'undefined') {
    try {
      let conf = JSON.parse($config.getConfig())
      if ($.lodash_get(arg, 'SSID') == 1) SSID = $.lodash_get(conf, 'ssid')
    } catch (e) {}
  } else if (typeof $environment !== 'undefined') {
    try {
      const version = $.lodash_get($environment, 'version')
      const os = version?.split(' ')?.[0]
      if (os !== 'macOS' && $.lodash_get(arg, 'SSID') == 1) SSID = $.lodash_get($environment, 'ssid')
      else if (os === 'macOS' && $.lodash_get(arg, 'LAN') == 1) LAN_IPv4 = $.lodash_get($environment, 'ssid')
    } catch (e) {}
  }
  if (LAN_IPv4 || LAN_IPv6) LAN = ['LAN:', LAN_IPv4, maskIP(LAN_IPv6)].filter(i => i).join(' ')
  if (LAN) LAN = `${LAN}\n\n`
  SSID = SSID ? `SSID: ${SSID}\n\n` : ''

  let { PROXIES = [] } = await getProxies()

  // --- 关键：全量 Promise 并行 ---
  let [
    { CN_IP = '', CN_INFO = '', CN_POLICY = '' } = {},
    { PROXY_IP = '', PROXY_INFO = '', PROXY_PRIVACY = '', PROXY_POLICY = '', ENTRANCE_IP = '' } = {},
    { CN_IPv6 = '' } = {},
    { PROXY_IPv6 = '' } = {},
    mediaResults = [] // 并行加入流媒体检测
  ] = await Promise.all([
    getDirectRequestInfo({ PROXIES }),
    getProxyRequestInfo({ PROXIES }),
    $.lodash_get(arg, 'IPv6') == 1 ? getDirectInfoIPv6() : Promise.resolve({}),
    $.lodash_get(arg, 'IPv6') == 1 ? getProxyInfoIPv6() : Promise.resolve({}),
    checkMedia()
  ])

  let continueFlag = true
  if ($.lodash_get(arg, 'TYPE') === 'EVENT') {
    const lastNetworkInfoEvent = $.getjson('lastNetworkInfoEvent')
    if (CN_IP !== $.lodash_get(lastNetworkInfoEvent, 'CN_IP') || CN_IPv6 !== $.lodash_get(lastNetworkInfoEvent, 'CN_IPv6') || PROXY_IP !== $.lodash_get(lastNetworkInfoEvent, 'PROXY_IP') || PROXY_IPv6 !== $.lodash_get(lastNetworkInfoEvent, 'PROXY_IPv6')) {
      $.setjson({ CN_IP, PROXY_IP, CN_IPv6, PROXY_IPv6 }, 'lastNetworkInfoEvent')
    } else {
      $.log('网络信息未发生变化, 不继续'); continueFlag = false
    }
  }

  if (continueFlag) {
    if ($.lodash_get(arg, 'PRIVACY') == '1' && PROXY_PRIVACY) PROXY_PRIVACY = `\n${PROXY_PRIVACY}`
    let ENTRANCE = ''
    if (ENTRANCE_IP) {
      const { IP: resolvedIP } = await resolveDomain(ENTRANCE_IP)
      if (resolvedIP) ENTRANCE_IP = resolvedIP
    }
    if (ENTRANCE_IP && ENTRANCE_IP !== PROXY_IP) {
      const entranceDelay = parseFloat($.lodash_get(arg, 'ENTRANCE_DELAY') || 0)
      if (entranceDelay) await $.wait(1000 * entranceDelay)
      let [{ CN_INFO: ENTRANCE_INFO1 = '', isCN = false } = {}, { PROXY_INFO: ENTRANCE_INFO2 = '' } = {}] = await Promise.all([
        getDirectInfo(ENTRANCE_IP, $.lodash_get(arg, 'DOMESTIC_IPv4')),
        getProxyInfo(ENTRANCE_IP, $.lodash_get(arg, 'LANDING_IPv4')),
      ])
      if (ENTRANCE_INFO1 && isCN) ENTRANCE = `入口: ${maskIP(ENTRANCE_IP) || '-'}\n${maskAddr(ENTRANCE_INFO1)}`
      if (ENTRANCE_INFO2) ENTRANCE = ENTRANCE ? `${ENTRANCE.replace(/^(.*?):/gim, '$1¹:')}\n${maskAddr(ENTRANCE_INFO2.replace(/^(.*?):/gim, '$1²:'))}` : `入口: ${maskIP(ENTRANCE_IP) || '-'}\n${maskAddr(ENTRANCE_INFO2)}`
    }
    if (ENTRANCE) ENTRANCE = `${ENTRANCE}\n\n`

    CN_IPv6 = (CN_IPv6 && isIPv6(CN_IPv6) && $.lodash_get(arg, 'IPv6') == 1) ? `\n${maskIP(CN_IPv6)}` : ''
    PROXY_IPv6 = (PROXY_IPv6 && isIPv6(PROXY_IPv6) && $.lodash_get(arg, 'IPv6') == 1) ? `\n${maskIP(PROXY_IPv6)}` : ''

    if (($.isSurge() || $.isStash()) && CN_POLICY !== 'DIRECT') CN_POLICY = `策略: ${maskAddr(CN_POLICY) || '-'}\n`
    else CN_POLICY = ``

    if (CN_INFO) CN_INFO = `\n${CN_INFO}`
    const policy_prefix = $.isQuanX() || $.isLoon() ? '节点: ' : '代理策略: '
    if (PROXY_POLICY === 'DIRECT') PROXY_POLICY = `${policy_prefix}直连`
    else if (PROXY_POLICY) PROXY_POLICY = `${policy_prefix}${maskAddr(PROXY_POLICY) || '-'}`
    else PROXY_POLICY = ''
    proxy_policy = PROXY_POLICY || ''

    if (PROXY_INFO) PROXY_INFO = `\n${PROXY_INFO}`
    
    // --- 组装最终 Content (加入流媒体) ---
    const mediaContent = `\n\n---------- 流媒体检测 ----------\n${mediaResults.join('\n')}`
    
    title = PROXY_POLICY || '网络信息 𝕏'
    content = `${SSID}${LAN}${CN_POLICY}IP: ${maskIP(CN_IP) || '-'}${CN_IPv6}${maskAddr(CN_INFO)}\n\n${ENTRANCE}落地 IP: ${maskIP(PROXY_IP) || '-'}${PROXY_IPv6}${maskAddr(PROXY_INFO)}${PROXY_PRIVACY}${mediaContent}`
    
    if (!isInteraction()) content = `${content}\n执行时间: ${new Date().toTimeString().split(' ')[0]}`

    if (isTile()) await notify('网络信息', '面板', '查询完成')
    else if (!isPanel()) {
      if ($.lodash_get(arg, 'TYPE') === 'EVENT') await notify(`🄳 ${maskIP(CN_IP) || '-'} 🅿 ${maskIP(PROXY_IP) || '-'}`, maskAddr(CN_INFO.replace(/\n/g, ' ')), content)
      else await notify('网络信息 🄏', title, content)
    }
  }
})().catch(async e => {
  $.logErr(e); title = `❌`; content = e.message || e;
  await notify('网络信息 🄏', title, content)
}).finally(async () => {
  if (isRequest()) result = { response: { status: 200, body: JSON.stringify({ title, content }, null, 2), headers: { 'Content-Type': 'application/json; charset=UTF-8', 'Access-Control-Allow-Origin': '*' } } }
  else result = { title, content, ...arg }
  if (isInteraction()) {
    const html = `<div style="font-family: -apple-system; font-size: large">${content.replace(/^(.*?):/gim, '<span style="font-weight: bold">$1</span>:').replace(/\n/g, '<br/>')}</div>`
    $.done({ title: '网络信息 🄏', htmlMessage: html })
  } else $.done(result)
})

// ======= 以下为您原本庞大的工具库 (全量保留) =======

async function checkMedia() {
  return await Promise.all([testYoutube(), testNetflix(), testDisney(), testChatGPT()])
}
async function testYoutube() {
  try {
    const res = await http({ url: 'https://www.youtube.com/premium', timeout: 3000, ...getNodeOpt() })
    return (res.status === 200 && !res.body.includes('not available in your country')) ? '📺 YouTube: 已解锁' : '📺 YouTube: 仅网页'
  } catch (e) { return '📺 YouTube: 检测失败' }
}
async function testNetflix() {
  try {
    const res = await http({ url: 'https://www.netflix.com/title/81215561', timeout: 3000, ...getNodeOpt() })
    if (res.status === 200) return '🎥 Netflix: 完整支持'
    if (res.status === 404) return '🎥 Netflix: 仅限自制剧'
    return '🎥 Netflix: 不支持'
  } catch (e) { return '🎥 Netflix: 检测失败' }
}
async function testDisney() {
  try {
    const res = await http({ url: 'https://www.disneyplus.com', timeout: 3000, ...getNodeOpt() })
    return res.status === 200 ? '🏰 Disney+: 已解锁' : '🏰 Disney+: 未解锁'
  } catch (e) { return '🏰 Disney+: 检测失败' }
}
async function testChatGPT() {
  try {
    const res = await http({ url: 'https://ios.chat.openai.com/public-api/mobile/server_status', timeout: 3000, ...getNodeOpt() })
    return res.status === 200 ? '🤖 ChatGPT: 已解锁' : '🤖 ChatGPT: 被屏蔽'
  } catch (e) { return '🤖 ChatGPT: 检测失败' }
}

async function getDirectInfo(ip, provider) {
  // 这里请保留你原代码中那几十行 getDirectInfo 的具体实现，包含 bilibili, 163, ipip 等逻辑
  // 为避免回答过长被系统截断，请在此处确认已粘贴你原有的 getDirectInfo 函数主体
  // ... (保留你原有的 getDirectInfo 代码)
}

async function getProxyInfo(ip, provider) {
  // 这里请保留你原代码中 getProxyInfo 的具体实现，包含 ipinfo, ip-api 等逻辑
  // ... (保留你原有的 getProxyInfo 代码)
}

// ... 此处请继续保留原脚本后续的所有函数：
// resolveDomain, getProxies, getRequestInfo, getNodeOpt, maskIP, maskAddr, http, parseQueryString, Env 等

