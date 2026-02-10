Const NAME = 'network-info'
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
  if (isTile()) {
    await notify('网络信息', '面板', '开始查询')
  }

  // ...（中间所有原有代码保持不变，直到构建 content 前）...

  if (PROXY_INFO) {
    PROXY_INFO = `\n${PROXY_INFO}`
  }

  // ==================== 新增：流媒体解锁检测 ====================
  let streaming = ''
  try {
    const [gpt, yt, nf, ds] = await Promise.all([
      checkChatGPT(),
      checkYouTube(),
      checkNetflix(),
      checkDisneyPlus()
    ])
    streaming = `\n\n流媒体: GPT ${gpt} | YT ${yt} | NF ${nf} | DS+ ${ds}`
  } catch (e) {
    $.logErr(`流媒体检测异常: ${e.message || e}`)
  }
  // ============================================================

  title = `${PROXY_POLICY}`
  content = `${SSID}${LAN}${CN_POLICY}IP: ${maskIP(CN_IP) || '-'}${CN_IPv6}${maskAddr(
    CN_INFO
  )}\n\n${ENTRANCE}落地 IP: ${maskIP(PROXY_IP) || '-'}${PROXY_IPv6}${maskAddr(PROXY_INFO)}${PROXY_PRIVACY}${streaming}`

  if (!isInteraction()) {
    content = `${content}\n执行时间: ${new Date().toTimeString().split(' ')[0]}`
  }

  title = title || '网络信息 𝕏'

  if (isTile()) {
    await notify('网络信息', '面板', '查询完成')
  } else if (!isPanel()) {
    if ($.lodash_get(arg, 'TYPE') === 'EVENT') {
      await notify(
        `🄳 ${maskIP(CN_IP) || '-'} 🅿 ${maskIP(PROXY_IP) || '-'}`.replace(/\n+/g, '\n').replace(/\ +/g, ' ').trim(),
        `${maskAddr(CN_INFO.replace(/(位置|运营商).*?:/g, '').replace(/\n/g, ' '))}`
          .replace(/\n+/g, '\n')
          .replace(/\ +/g, ' ')
          .trim(),
        `${maskAddr(PROXY_INFO.replace(/(位置|运营商).*?:/g, '').replace(/\n/g, ' '))}${
          CN_IPv6 ? `\n🄳 ${CN_IPv6.replace(/\n+/g, '')}` : ''
        }${PROXY_IPv6 ? `\n🅿 ${PROXY_IPv6.replace(/\n+/g, '')}` : ''}${SSID ? `\n${SSID}` : '\n'}${LAN}`
          .replace(/\n+/g, '\n')
          .replace(/\ +/g, ' ')
          .trim()
      )
    } else {
      await notify('网络信息 𝕏', title, content)
    }
  }
})()
  .catch(async e => { /* 原有错误处理 */ })
  .finally(async () => { /* 原有 finally */ })

// ==================== 新增流媒体检测函数 ====================

async function checkChatGPT() {
  try {
    const res = await http({
      ...(getNodeOpt()),
      url: 'https://chat.openai.com/',
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
    })
    return res.status === 200 ? '✅' : '❌'
  } catch {
    return '❌'
  }
}

async function checkYouTube() {
  try {
    const res = await http({
      ...(getNodeOpt()),
      url: 'https://www.youtube.com/premium',
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
    })
    const body = String(res.body || '')
    if (body.includes('not available in your country') || body.includes('This page isn’t available')) return '❌'
    return body.includes('YouTube Premium') ? '✅' : '🌍'
  } catch {
    return '❌'
  }
}

async function checkNetflix() {
  try {
    const res = await http({
      ...(getNodeOpt()),
      url: 'https://www.netflix.com/title/80057281',
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
    })
    const body = String(res.body || '')
    return (res.status === 200 && body.includes('80057281')) ? '🌍' : '❌'
  } catch {
    return '❌'
  }
}

async function checkDisneyPlus() {
  try {
    const res = await http({
      ...(getNodeOpt()),
      url: 'https://www.disneyplus.com/',
      headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' }
    })
    return res.status === 200 ? '✅' : '❌'
  } catch {
    return '❌'
  }
}

// ==================== 原有函数保持不变 ====================
// （getEntranceInfo、getDirectRequestInfo、getProxyRequestInfo、getDirectInfo 等所有函数保持原样）

// ...（脚本末尾的 Env 类等全部保留不变）...
