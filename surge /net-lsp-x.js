/*
 * 网络信息 𝕏 - 最终稳定版 (Quantumult X 专用)
 */

const $ = new Env("网络信息 𝕏");

// --- 核心配置 ---
let title = "网络信息 𝕏";
let content = "";
let results = {
  direct: { ip: "未知", addr: "查询失败" },
  proxy: { ip: "未知", addr: "查询失败" },
  media: []
};

!(async () => {
  // 1. 获取网络基础信息 (SSID/LAN)
  let networkInfo = "";
  if (typeof $network !== "undefined") {
    const ssid = $network.wifi?.ssid;
    const v4 = $network.v4?.primaryAddress;
    if (ssid) networkInfo += `SSID: ${ssid}\n`;
    if (v4) networkInfo += `LAN: ${v4}\n`;
  }
  if (networkInfo) networkInfo += "\n";

  // 2. 并行执行所有任务，设置 5 秒强制超时
  await Promise.all([
    getDirectIP(),
    getProxyIP(),
    checkMedia()
  ]).timeout(5000).catch(e => console.log("部分查询超时"));

  // 3. 组装内容
  const directPart = `直连 IP: ${mask(results.direct.ip)}\n📍 ${results.direct.addr}`;
  const proxyPart = `落地 IP: ${mask(results.proxy.ip)}\n📍 ${results.proxy.addr}`;
  const mediaPart = `\n\n---------- 流媒体检测 ----------\n${results.media.join("\n")}`;

  content = `${networkInfo}${directPart}\n\n${proxyPart}${mediaPart}`;

  // 4. 判断运行模式输出结果
  if (typeof $tile !== "undefined") {
    // 面板模式
    $.done({
      title: results.proxy.ip !== "未知" ? `节点: ${results.proxy.addr.split(' ')[0]}` : title,
      content: content,
      icon: "network",
      "icon-color": "#5AC8FA"
    });
  } else {
    // 弹窗或普通模式
    $.msg(title, "", content);
    $.done();
  }
})().catch(e => {
  console.log("脚本崩溃: " + e);
  $.done();
});

// ======= 查询函数集 =======

async function getDirectIP() {
  return new Promise(resolve => {
    $.get({ url: "https://httpbin.org/ip" }, (err, resp, data) => {
      try {
        results.direct.ip = JSON.parse(data).origin.split(',')[0];
        results.direct.addr = "本地网络";
      } catch (e) {}
      resolve();
    });
  });
}

async function getProxyIP() {
  return new Promise(resolve => {
    // 使用带 policy 的参数确保走代理
    let opts = { url: "http://ip-api.com/json/?lang=zh-CN" };
    if (typeof $argument !== "undefined") opts.opts = { policy: $argument };

    $.get(opts, (err, resp, data) => {
      try {
        const info = JSON.parse(data);
        results.proxy.ip = info.query;
        results.proxy.addr = `${info.country} ${info.city}`;
      } catch (e) {}
      resolve();
    });
  });
}

async function checkMedia() {
  const mediaList = [
    { name: "YouTube", url: "https://www.youtube.com/premium", key: "Premium" },
    { name: "Netflix", url: "https://www.netflix.com/title/81215561", key: "Netflix" },
    { name: "ChatGPT", url: "https://ios.chat.openai.com/public-api/mobile/server_status", key: "200" }
  ];

  const tasks = mediaList.map(item => {
    return new Promise(resolve => {
      let opts = { url: item.url };
      if (typeof $argument !== "undefined") opts.opts = { policy: $argument };
      
      $.get(opts, (err, resp, data) => {
        if (data && data.includes(item.key)) {
          results.media.push(`✅ ${item.name}: 已解锁`);
        } else {
          results.media.push(`❌ ${item.name}: 未解锁`);
        }
        resolve();
      });
    });
  });
  return Promise.all(tasks);
}

// 辅助：打马赛克
function mask(ip) {
  if (!ip || ip === "未知") return ip;
  return ip.replace(/(\d+)\.(\d+)\.(\d+)\.(\d+)/, "$1.$2.*.*");
}

// ======= 核心环境 (Env) 注入 =======
function Env(name) {
  this.name = name;
  this.get = (opts, cb) => $httpClient.get(opts, cb);
  this.msg = (t, s, m) => $notification.post(t, s, m);
  this.done = (obj) => $done(obj);
}

// 补充 Promise 超时逻辑
Promise.prototype.timeout = function (ms) {
  let timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms));
  return Promise.race([this, timeout]);
};
