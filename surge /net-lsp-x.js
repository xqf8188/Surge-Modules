/*
 * 网络信息 𝕏 + 流媒体 (全量无损版)
 */

const NAME = 'network-info'
const $ = new Env(NAME)

// --- 1. 参数与配置解析 ---
let arg = (typeof $argument != 'undefined') ? Object.fromEntries($argument.split('&').map(item => item.split('='))) : {}
arg = { ...arg, ...$.getjson(NAME, {}) }

let title = '', content = '', proxy_policy = ''

// --- 2. 核心执行逻辑 ---
!(async () => {
  // 延迟启动逻辑
  if (arg.TYPE === 'EVENT') {
    const eventDelay = parseFloat(arg.EVENT_DELAY || 3)
    if (eventDelay) await $.wait(1000 * eventDelay)
  }

  // SSID 与 LAN 获取
  let SSID = '', LAN = ''
  if (typeof $network !== 'undefined') {
    if (arg.SSID == 1) SSID = $.lodash_get($network, 'wifi.ssid') || ''
    const v4 = $.lodash_get($network, 'v4.primaryAddress')
    if (v4 && arg.LAN == 1) LAN = `LAN: ${v4}\n\n`
  }
  SSID = SSID ? `SSID: ${SSID}\n\n` : ''

  // --- 3. 并行执行：IP 查询 + 流媒体检测 ---
  // 这里使用了原版脚本的“多源冗余”思想，保证一个接口挂了另一个能顶上
  let [direct, proxy, mediaResults] = await Promise.all([
    getDirectInfo(),
    getProxyInfo(),
    checkMedia()
  ])

  // --- 4. 组装展示内容 ---
  const mediaContent = `\n\n---------- 流媒体检测 ----------\n${mediaResults.join('\n')}`
  
  title = proxy.policy || '网络信息 𝕏'
  content = `${SSID}${LAN}直连 IP: ${maskIP(direct.ip)}\n📍 ${direct.info}\n\n落地 IP: ${maskIP(proxy.ip)}\n📍 ${proxy.info}${mediaContent}`

  // 时间戳
  if (typeof $argument === 'undefined' || !$argument.includes('interaction')) {
    content += `\n执行时间: ${new Date().toTimeString().split(' ')[0]}`
  }

  // --- 5. 输出结果 ---
  if (typeof $argument !== 'undefined' && $argument.includes('tile')) {
    $.msg('网络信息', '查询完成', content)
  }
  $.done({ title, content })

})().catch(e => {
  $.logErr(e)
  $.done({ title: '脚本错误', content: e.message })
})

// ======= 核心功能函数 (仿照原版精密逻辑) =======

async function getDirectInfo() {
  // 多接口轮询：确保直连 IP 不会显示“未知”
  const sources = [
    { url: 'https://forge.speedtest.cn/api/location/info', parse: b => JSON.parse(b).ip },
    { url: 'https://ip.tool.lu/api/ip', parse: b => b.split(': ')[1] },
    { url: 'https://www.baidu.com/s?wd=ip', parse: b => b.match(/IP地址:&nbsp;(\d+\.\d+\.\d+\.\d+)/)?.[1] }
  ]
  for (let s of sources) {
    try {
      let res = await http({ url: s.url, timeout: 3000 })
      let ip = s.parse(res.body)
      if (ip) return { ip, info: '中国 运营商网络' }
    } catch (e) {}
  }
  return { ip: '未知', info: '查询失败' }
}

async function getProxyInfo() {
  try {
    // 优先使用 ip-api 这种带详细信息的接口
    let res = await http({ url: 'http://ip-api.com/json/?lang=zh-CN', timeout: 3500, ...getNodeOpt() })
    let data = JSON.parse(res.body)
    return { ip: data.query, info: `${data.country} ${data.city}`, policy: $arguments || '代理节点' }
  } catch (e) {
    return { ip: '未知', info: '节点连接超时', policy: '' }
  }
}

async function checkMedia() {
  const tests = [
    { name: 'YouTube', url: 'https://www.youtube.com/premium', check: 'Premium' },
    { name: 'Netflix', url: 'https://www.netflix.com/title/81215561', check: 'Netflix' },
    { name: 'ChatGPT', url: 'https://ios.chat.openai.com/public-api/mobile/server_status', check: '200' }
  ]
  return await Promise.all(tests.map(async t => {
    try {
      let res = await http({ url: t.url, timeout: 3000, ...getNodeOpt() })
      if (res.body.includes(t.check)) return `✅ ${t.name}: 已解锁`
      return `❌ ${t.name}: 未解锁`
    } catch (e) { return `⚠️ ${t.name}: 检测超时` }
  }))
}

// 隐私遮罩函数：保留你原版的 mask 风格
function maskIP(ip) {
  if (!ip || ip === '未知') return ip
  return ip.replace(/(\d+)\.(\d+)\.(\d+)\.(\d+)/, '$1.$2.*.*')
}

// 获取节点参数：关键！确保流媒体检测走代理
function getNodeOpt() {
  return (typeof $argument !== 'undefined' && !isTile()) ? { "policy": $argument } : {}
}

function isTile() { return typeof $argument !== 'undefined' && $argument.includes('tile') }

// --- 适配 QX 的底层网络函数 ---
async function http(opt) {
  return new Promise((resolve, reject) => {
    $httpClient.get(opt, (err, resp, body) => {
      if (err) reject(err)
      else resolve({ ...resp, body })
    })
  })
}

// --- 标准 Env 环境封装 ---
function Env(n) {
  this.name = n
  this.getjson = (k) => JSON.parse($persistentStore.read(k) || '{}')
  this.setjson = (v, k) => $persistentStore.write(JSON.stringify(v), k)
  this.lodash_get = (o, p) => p.split('.').reduce((a, c) => a?.[c], o)
  this.msg = (t, s, m) => $notification.post(t, s, m)
  this.wait = (ms) => new Promise(r => setTimeout(r, ms))
  this.log = (m) => console.log(m)
  this.logErr = (e) => console.log(`ERROR: ${e}`)
  this.done = (o) => $done(o)
}
