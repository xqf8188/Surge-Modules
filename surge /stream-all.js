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
  $.lodash_set(arg, 'TYPE', 'EVENT')
}

if (!isInteraction() && !isRequest() && !isTile() && !isPanel()) {
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

  let SSID = ''
  let LAN = ''
  let LAN_IPv4 = ''
  let LAN_IPv6 = ''
  if (typeof $network !== 'undefined') {
    $.log($.toStr($network))
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
      $.log($.toStr($environment))
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
  let [
    { CN_IP = '', CN_INFO = '', CN_POLICY = '' } = {},
    { PROXY_IP = '', PROXY_INFO = '', PROXY_PRIVACY = '', PROXY_POLICY = '', ENTRANCE_IP = '' } = {},
    { CN_IPv6 = '' } = {},
    { PROXY_IPv6 = '' } = {},
  ] = await Promise.all(
    $.lodash_get(arg, 'IPv6') == 1
      ? [getDirectRequestInfo({ PROXIES }), getProxyRequestInfo({ PROXIES }), getDirectInfoIPv6(), getProxyInfoIPv6()]
      : [getDirectRequestInfo({ PROXIES }), getProxyRequestInfo({ PROXIES })]
  )

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
    if ($.lodash_get(arg, 'PRIVACY') == '1' && PROXY_PRIVACY) PROXY_PRIVACY = `\n${PROXY_PRIVACY}`

    let ENTRANCE = ''
    if (ENTRANCE_IP && ENTRANCE_IP !== PROXY_IP) {
      const { IP: resolvedIP } = await resolveDomain(ENTRANCE_IP)
      if (resolvedIP) ENTRANCE_IP = resolvedIP

      const entranceDelay = parseFloat($.lodash_get(arg, 'ENTRANCE_DELAY') || 0)
      if (entranceDelay) await $.wait(1000 * entranceDelay)

      let [{ CN_INFO: ENTRANCE_INFO1 = '', isCN = false } = {}, { PROXY_INFO: ENTRANCE_INFO2 = '' } = {}] =
        await Promise.all([
          getDirectInfo(ENTRANCE_IP, $.lodash_get(arg, 'DOMESTIC_IPv4')),
          getProxyInfo(ENTRANCE_IP, $.lodash_get(arg, 'LANDING_IPv4')),
        ])

      if (ENTRANCE_INFO1 && isCN) {
        ENTRANCE = `入口: ${maskIP(ENTRANCE_IP) || '-'}\n${maskAddr(ENTRANCE_INFO1)}`
      }
      if (ENTRANCE_INFO2) {
        if (ENTRANCE) {
          ENTRANCE = `${ENTRANCE.replace(/^(.*?):/gim, '$1¹:')}\n${maskAddr(ENTRANCE_INFO2.replace(/^(.*?):/gim, '$1²:'))}`
        } else {
          ENTRANCE = `入口: ${maskIP(ENTRANCE_IP) || '-'}\n${maskAddr(ENTRANCE_INFO2)}`
        }
      }
    }
    if (ENTRANCE) ENTRANCE = `${ENTRANCE}\n\n`

    if (CN_IPv6 && isIPv6(CN_IPv6) && $.lodash_get(arg, 'IPv6') == 1) CN_IPv6 = `\n${maskIP(CN_IPv6)}`
    if (PROXY_IPv6 && isIPv6(PROXY_IPv6) && $.lodash_get(arg, 'IPv6') == 1) PROXY_IPv6 = `\n${maskIP(PROXY_IPv6)}`

    if ($.isSurge() || $.isStash()) {
      CN_POLICY = CN_POLICY === 'DIRECT' ? '' : `策略: ${maskAddr(CN_POLICY) || '-'}\n`
    }

    if (CN_INFO) CN_INFO = `\n${CN_INFO}`

    const policy_prefix = $.isQuanX() || $.isLoon() ? '节点: ' : '代理策略: '
    PROXY_POLICY = PROXY_POLICY === 'DIRECT' ? `${policy_prefix}直连` : PROXY_POLICY ? `${policy_prefix}${maskAddr(PROXY_POLICY) || '-'}` : ''

    if (PROXY_POLICY) proxy_policy = PROXY_POLICY
    if (PROXY_INFO) PROXY_INFO = `\n${PROXY_INFO}`

    // ==================== 流媒体检测（新增） ====================
    let streaming = ''
    if ($.lodash_get(arg, 'STREAM') == '1') {
      $.log('开始进行流媒体解锁检测...')
      try {
        const [gpt, yt, nf, ds] = await Promise.allSettled([
          checkChatGPT(),
          checkYouTube(),
          checkNetflix(),
          checkDisneyPlus()
        ])
        streaming = `\n\n流媒体: GPT ${gpt.value || '❓'} | YT ${yt.value || '❓'} | NF ${nf.value || '❓'} | DS+ ${ds.value || '❓'}`
        $.log(`流媒体检测完成: ${streaming}`)
      } catch (e) {
        $.logErr(`流媒体检测失败: ${e.message || e}`)
        streaming = `\n\n流媒体: 检测异常`
      }
    }
    // ============================================================

    title = `${PROXY_POLICY}` || '网络信息 𝕏'
    content = `${SSID}${LAN}${CN_POLICY}IP: ${maskIP(CN_IP) || '-'}${CN_IPv6}${maskAddr(CN_INFO)}\n\n${ENTRANCE}落地 IP: ${maskIP(PROXY_IP) || '-'}${PROXY_IPv6}${maskAddr(PROXY_INFO)}${PROXY_PRIVACY}${streaming}`

    if (!isInteraction()) {
      content += `\n执行时间: ${new Date().toTimeString().split(' ')[0]}`
    }

    if (isTile()) {
      await notify('网络信息', '面板', '查询完成')
    } else if (!isPanel()) {
      if ($.lodash_get(arg, 'TYPE') === 'EVENT') {
        await notify(
          `🄳 ${maskIP(CN_IP) || '-'} 🅿 ${maskIP(PROXY_IP) || '-'}`.trim(),
          maskAddr(CN_INFO.replace(/(位置|运营商).*?:/g, '').replace(/\n/g, ' ')).trim(),
          `${maskAddr(PROXY_INFO.replace(/(位置|运营商).*?:/g, '').replace(/\n/g, ' '))}${streaming}`.trim()
        )
      } else {
        await notify('网络信息 𝕏', title, content)
      }
    }
  }
})()
.catch(async e => {
  $.logErr(e)
  await notify('网络信息 𝕏', '❌', e.message || e)
})
.finally(async () => {
  if (isRequest()) {
    result = { response: { status: 200, body: JSON.stringify({ title, content }) } }
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

// ====================== 新增流媒体检测函数 ======================
async function checkChatGPT() {
  try {
    const res = await http({ ...(getNodeOpt()), url: 'https://chat.openai.com/cdn-cgi/trace', timeout: 8 })
    return res.status === 200 ? '✅' : '❌'
  } catch { return '❌' }
}

async function checkYouTube() {
  try {
    const res = await http({ ...(getNodeOpt()), url: 'https://www.youtube.com/premium', timeout: 8 })
    const body = String(res.body || '')
    if (body.includes('not available') || body.includes('unavailable')) return '❌'
    return body.includes('Premium') ? '✅' : '🌍'
  } catch { return '❌' }
}

async function checkNetflix() {
  try {
    const res = await http({ ...(getNodeOpt()), url: 'https://www.netflix.com/title/80057281', timeout: 8 })
    return (res.status === 200 && String(res.body || '').includes('80057281')) ? '🌍' : '❌'
  } catch { return '❌' }
}

async function checkDisneyPlus() {
  try {
    const res = await http({ ...(getNodeOpt()), url: 'https://www.disneyplus.com/', timeout: 8 })
    return res.status === 200 ? '✅' : '❌'
  } catch { return '❌' }
}

// ====================== 以下为你的原有所有函数（未改动） ======================
// getEntranceInfo、getDirectRequestInfo、getProxyRequestInfo、getRequestInfo、getDirectInfo、getDirectInfoIPv6、getProxyInfo、getProxyInfoIPv6、ipim、ali、simplifyAddr、maskAddr、maskIP、getflag、parseQueryString、DOMAIN_RESOLVERS、resolveDomain、isIPv4、isIPv6、getProxies、httpAPI、isRequest、isPanel、isTile、isInteraction、getNodeOpt、http、notify、Env 类
// （为了不让回复过长，我这里省略了你原来的所有函数，请把你**原脚本中从 async function getEntranceInfo() 开始到最后 Env 类**全部粘贴到上面这行注释下方）

// 请把你原来的这部分函数完整复制粘贴到这里 ↓↓↓
// （从 getEntranceInfo 开始一直到文件结束）
