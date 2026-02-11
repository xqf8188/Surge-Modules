/*
 * 网络信息 𝕏 - Surge 完美修复版
 * 解决面板不显示、通知正常的问题
 */

const $ = new Env("网络信息 𝕏");

!(async () => {
  $.log("开始查询...");

  // 1. 获取网络基础信息
  let ssid = $network.wifi.ssid || "";
  let v4 = $network.v4.primaryAddress || "";
  
  // 2. 并行查询
  let [direct, proxy, media] = await Promise.all([
    getDirectInfo(),
    getProxyInfo(),
    checkMedia()
  ]);

  // 3. 组装面板显示内容 (针对面板优化，去除冗余)
  let panelContent = `直连: ${mask(direct.ip)} | ${direct.info}\n`;
  panelContent += `落地: ${mask(proxy.ip)} | ${proxy.info}\n`;
  panelContent += `YouTube: ${media[0]} | Netflix: ${media[1]} | GPT: ${media[2]}`;

  // 4. 组装通知显示内容
  let notifyContent = `SSID: ${ssid}  LAN: ${v4}\n\n`;
  notifyContent += `直连 IP: ${mask(direct.ip)} (${direct.info})\n`;
  notifyContent += `落地 IP: ${mask(proxy.ip)} (${proxy.info})\n\n`;
  notifyContent += `---------- 流媒体检测 ----------\n`;
  notifyContent += `YouTube: ${media[0]}\nNetflix: ${media[1]}\nChatGPT: ${media[2]}`;

  // 5. 核心：根据不同环境返回数据
  if (typeof $panel !== "undefined") {
    // 【修正】Surge 面板专用返回格式
    $.done({
      title: ssid ? `网络: ${ssid}` : "网络信息 𝕏",
      content: panelContent,
      icon: "network",
      "icon-color": "#5AC8FA"
    });
  } else {
    // 普通运行模式弹出通知
    $.msg("网络信息 𝕏", `落地: ${proxy.info}`, notifyContent);
    $.done();
  }
})().catch(e => {
  $.logErr(e);
  $.done();
});

// ======= [功能模块] =======

async function getDirectInfo() {
  try {
    let res = await httpGet("https://httpbin.org/ip");
    return { ip: JSON.parse(res.body).origin.split(',')[0], info: "直连" };
  } catch (e) { return { ip: "未知", info: "超时" }; }
}

async function getProxyInfo() {
  try {
    let res = await httpGet("http://ip-api.com/json/?lang=zh-CN");
    let data = JSON.parse(res.body);
    return { ip: data.query, info: data.country };
  } catch (e) { return { ip: "未知", info: "超时" }; }
}

async function checkMedia() {
  const list = [
    { url: "https://www.youtube.com/premium", key: "Premium" },
    { url: "https://www.netflix.com/title/81215561", key: "Netflix" },
    { url: "https://ios.chat.openai.com/public-api/mobile/server_status", key: "200" }
  ];
  return await Promise.all(list.map(item => {
    return new Promise(resolve => {
      $.http.get({ url: item.url, timeout: 3000 }, (err, resp, data) => {
        resolve(!err && data && data.includes(item.key) ? "✅" : "❌");
      });
    });
  }));
}

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

function Env(name) {
  this.name = name;
  this.http = $httpClient;
  this.msg = (t, s, m) => $notification.post(t, s, m);
  this.log = (m) => console.log(m);
  this.logErr = (e) => console.log(e);
  this.done = (o) => $done(o);
}
