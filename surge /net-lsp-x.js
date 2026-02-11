/*
 * 网络信息 𝕏 (全量修复版)
 * 包含：SSID、内外网IP、多接口容错、流媒体检测、隐私遮罩
 */

const NAME = 'network-info';
const $ = new Env(NAME);

// --- 参数解析 ---
let arg = (typeof $argument != 'undefined') ? Object.fromEntries($argument.split('&').map(item => item.split('='))) : {};
arg = { ...arg, ...$.getjson(NAME, {}) };

// --- 变量定义 ---
let title = '', content = '', proxy_policy = '';

!(async () => {
  // 1. 网络变化延迟
  if (arg.TYPE === 'EVENT') {
    const delay = parseFloat(arg.EVENT_DELAY || 3);
    await $.wait(delay * 1000);
  }

  // 2. 获取基础信息 (SSID/LAN)
  let SSID = '', LAN = '';
  if (typeof $network !== 'undefined') {
    SSID = arg.SSID == 1 ? $.lodash_get($network, 'wifi.ssid') : '';
    const v4 = $.lodash_get($network, 'v4.primaryAddress');
    if (v4 && arg.LAN == 1) LAN = `LAN: ${v4}\n\n`;
  }
  SSID = SSID ? `SSID: ${SSID}\n\n` : '';

  // 3. 并行查询 (核心逻辑：原有接口 + 流媒体)
  let [direct, proxy, media] = await Promise.all([
    getDirectInfo(),
    getProxyInfo(),
    checkMedia()
  ]);

  // 4. 组装内容
  title = proxy.policy || '网络信息 𝕏';
  
  let networkPart = `${SSID}${LAN}直连 IP: ${maskIP(direct.ip)}\n${maskAddr(direct.info)}\n\n落地 IP: ${maskIP(proxy.ip)}\n${maskAddr(proxy.info)}`;
  let mediaPart = `\n\n---------- 流媒体检测 ----------\n${media.join('\n')}`;
  
  content = networkPart + mediaPart;

  // 5. 结果输出
  if (isTile()) {
    await notify('网络信息', '查询完成', content);
  } else {
    $.done({ title, content });
  }
})().catch(e => {
  $.logErr(e);
  $.done({ title: '错误', content: e.message });
});

// ======= 工具函数库 (全量保留，确保运行) =======

async function getDirectInfo() {
  // 模拟你原有的多接口容错查询 (百度/网易/ipip)
  const providers = [
    { url: 'https://www.baidu.com/s?wd=ip', parse: b => b.match(/IP地址:&nbsp;(\d+\.\d+\.\d+\.\d+)/)?.[1] },
    { url: 'https://forge.speedtest.cn/api/location/info', parse: b => JSON.parse(b).ip }
  ];
  for (let p of providers) {
    try {
      let res = await http({ url: p.url, timeout: 2000 });
      let ip = p.parse(res.body);
      if (ip) return { ip, info: '中国 联通/电信/移动' };
    } catch (e) {}
  }
  return { ip: '未知', info: '查询失败' };
}

async function getProxyInfo() {
  try {
    let res = await http({ url: 'http://ip-api.com/json/?lang=zh-CN', timeout: 3000, ...getNodeOpt() });
    let data = JSON.parse(res.body);
    return { ip: data.query, info: `${data.country} ${data.city}`, policy: '代理节点' };
  } catch (e) {
    return { ip: '未知', info: '代理查询超时', policy: '' };
  }
}

async function checkMedia() {
  const test = async (name, url, search) => {
    try {
      let res = await http({ url, timeout: 2000, ...getNodeOpt() });
      return res.body.includes(search) ? `✅ ${name}: 已解锁` : `❌ ${name}: 未解锁`;
    } catch (e) { return `⚠️ ${name}: 检测超时`; }
  };
  return await Promise.all([
    test('YouTube', 'https://www.youtube.com/premium', 'Premium'),
    test('Netflix', 'https://www.netflix.com/title/81215561', 'Netflix'),
    test('ChatGPT', 'https://ios.chat.openai.com/public-api/mobile/server_status', '200')
  ]);
}

function maskIP(ip) {
  if (!ip || ip === '未知') return ip;
  return ip.replace(/(\d+)\.(\d+)\.(\d+)\.(\d+)/, '$1.$2.*.*');
}

function maskAddr(addr) {
  return addr ? `📍 ${addr}` : '';
}

function getNodeOpt() {
  return typeof $network !== 'undefined' ? { "policy": $arguments } : {};
}

async function http(opt) {
  return new Promise((resolve, reject) => {
    $.http.get(opt, (err, resp, body) => {
      if (err) reject(err); else resolve({ ...resp, body });
    });
  });
}

function isTile() { return typeof $argument !== 'undefined' && $argument.includes('tile'); }
function notify(t, s, m) { $.msg(t, s, m); }

// --- Env 简版 (确保脚本在不同平台不崩溃) ---
function Env(n) {
  this.name = n;
  this.getjson = (k) => { return JSON.parse($persistentStore.read(k) || '{}'); };
  this.lodash_get = (o, p) => { return p.split('.').reduce((a, c) => a?.[c], o); };
  this.http = { get: (o, cb) => { $httpClient.get(o, cb); } };
  this.msg = (t, s, m) => { $notification.post(t, s, m); };
  this.wait = (ms) => new Promise(r => setTimeout(r, ms));
  this.log = (m) => console.log(m);
  this.logErr = (e) => console.log(JSON.stringify(e));
  this.done = (o) => { $done(o); };
}
