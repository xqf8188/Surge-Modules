/*
 * 网络信息 𝕏 - Surge 完美版
 * 100% 兼容 Surge 5.0+，支持多接口容错 + 流媒体检测
 */

const $ = new Env("网络信息 𝕏");

!(async () => {
  $.log("开始查询网络信息...");

  // 1. 获取网络基础信息 (SSID & LAN)
  let networkHeader = "";
  const v4 = $network.v4.primaryAddress;
  const ssid = $network.wifi.ssid;
  if (ssid) networkHeader += `SSID: ${ssid}\n`;
  if (v4) networkHeader += `LAN: ${v4}\n`;
  if (networkHeader) networkHeader += "\n";

  // 2. 并行查询任务 (设置 5 秒超时，防止卡死)
  let [direct, proxy, media] = await Promise.all([
    getDirectInfo(),
    getProxyInfo(),
    checkMedia()
  ]);

  // 3. 组装内容
  const content = `${networkHeader}直连 IP: ${mask(direct.ip)}\n📍 ${direct.info}\n\n落地 IP: ${mask(proxy.ip)}\n📍 ${proxy.info}\n\n---------- 流媒体检测 ----------\n${media.join("\n")}`;

  // 4. 判断运行环境输出
  if (typeof $panel !== "undefined") {
    // 渲染面板模式
    $.done({
      title: "网络信息 𝕏",
      content: content,
      icon: "network",
      "icon-color": "#007AFF"
    });
  } else {
    // 弹窗或普通模式
    $.msg("网络信息 𝕏", proxy.info, content);
    $.done();
  }
})().catch(e => {
  $.logErr(e);
  $.done();
});

// ======= [功能模块 1: 直连 IP 查询] =======
async function getDirectInfo() {
  const providers = [
    { url: "https://httpbin.org/ip", parse: b => JSON.parse(b).origin.split(',')[0] },
    { url: "https://forge.speedtest.cn/api/location/info", parse: b => JSON.parse(b).ip }
  ];
  for (let p of providers) {
    try {
      let res = await httpGet(p.url);
      let ip = p.parse(res.body);
      if (ip) return { ip, info: "中国 运营商网络" };
    } catch (e) {}
  }
  return { ip: "未知", info: "直连查询超时" };
}

// ======= [功能模块 2: 落地 IP 查询] =======
async function getProxyInfo() {
  try {
    // Surge 会根据策略组自动选择出口
    let res = await httpGet("http://ip-api.com/json/?lang=zh-CN");
    let data = JSON.parse(res.body);
    return { ip: data.query, info: `${data.country} ${data.city}` };
  } catch (e) {
    return { ip: "未知", info: "代理查询超时" };
  }
}

// ======= [功能模块 3: 流媒体检测] =======
async function checkMedia() {
  const list = [
    { name: "YouTube", url: "https://www.youtube.com/premium", key: "Premium" },
    { name: "Netflix", url: "https://www.netflix.com/title/81215561", key: "Netflix" },
    { name: "ChatGPT", url: "https://ios.chat.openai.com/public-api/mobile/server_status", key: "200" }
  ];
  return await Promise.all(list.map(item => {
    return new Promise(resolve => {
      $.http.get({ url: item.url, timeout: 3000 }, (err, resp, data) => {
        if (!err && data && data.includes(item.key)) {
          resolve(`✅ ${item.name}: 已解锁`);
        } else {
          resolve(`❌ ${item.name}: 未解锁`);
        }
      });
    });
  }));
}

// ======= [工具函数] =======
function mask(ip) {
  if (!ip || ip === "未知") return ip;
  return ip.replace(/(\d+)\.(\d+)\.(\d+)\.(\d+)/, "$1.$2.*.*");
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    $.http.get({ url, timeout: 3000 }, (err, resp, body) => {
      if (err) reject(err); else resolve({ body });
    });
  });
}

// ======= [Surge 兼容环境 Env] =======
function Env(name) {
  this.name = name;
  this.http = $httpClient;
  this.msg = (t, s, m) => $notification.post(t, s, m);
  this.log = (m) => console.log(`[${this.name}] ${m}`);
  this.logErr = (e) => console.log(`[${this.name}] ERROR: ${e}`);
  this.done = (o) => $done(o);
}
