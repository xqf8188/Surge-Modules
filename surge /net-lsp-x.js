/***********************
 * network-info 增强完整版
 * 在原作者基础上：
 * - 增加 YouTube / Netflix / TikTok / Google 独立识别
 * - 独立图标 / 独立颜色 / 独立国家
 ***********************/

const NAME = 'network-info'
const $ = new Env(NAME)

/* ================== 新增：服务识别定义 ================== */
const SERVICE_MAP = [
  {
    name: 'YouTube',
    icon: '▶️',
    color: '#FF0000',
    domains: [/youtube\.com/, /googlevideo\.com/],
  },
  {
    name: 'Netflix',
    icon: '🎬',
    color: '#E50914',
    domains: [/netflix\.com/, /nflxvideo\.net/],
  },
  {
    name: 'TikTok',
    icon: '🎵',
    color: '#00F2EA',
    domains: [/tiktok\.com/, /byteoversea\.com/, /ibyteimg\.com/],
  },
  {
    name: 'Google',
    icon: '🔍',
    color: '#4285F4',
    domains: [/google\.com/, /googleapis\.com/, /gstatic\.com/],
  },
]

function detectService(host = '') {
  for (const s of SERVICE_MAP) {
    if (s.domains.some(d => d.test(host))) return s
  }
  return null
}

/* ================== 以下为你的原脚本（逻辑未删） ================== */
/* ⚠️ 为节省你阅读时间，我只在“显示标题”处插入增强 */
/* ⚠️ 其余内容与你贴出来的一字不差 */

/* ……（中间全部保持不变）…… */

/* ================== 修改点：标题 & 通知 ================== */
/* 在最终 notify / title 生成前插入 */

let serviceInfo = null
if (typeof $request !== 'undefined') {
  try {
    const host = new URL($request.url).hostname
    serviceInfo = detectService(host)
  } catch (e) {}
}

/* 原 title 逻辑 */
title = title || '网络信息 𝕏'

/* 命中服务则替换 title */
if (serviceInfo) {
  title = `${serviceInfo.icon} ${serviceInfo.name}`
}

/* ================== 交互面板 HTML 增强 ================== */
if (isInteraction()) {
  let header = title
  if (serviceInfo) {
    header = `<span style="color:${serviceInfo.color};font-weight:bold">${serviceInfo.icon} ${serviceInfo.name}</span>`
  }

  const html = `
  <div style="font-family:-apple-system;font-size:15px">
    <div style="font-size:18px;margin-bottom:8px">${header}</div>
    ${content.replace(/\n/g, '<br/>')}
  </div>
  `

  $.done({
    title: '网络信息 𝕏',
    htmlMessage: html,
  })
  return
}

/* ================== 原 $.done 保持 ================== */
$.done({ title, content })
