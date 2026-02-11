/*
 * 网络信息 𝕏 - Surge 稳定修复版
 * 专门解决面板显示“未知”而通知正常的问题
 */

const $ = new Env("网络信息 𝕏");

// 执行主逻辑
(async () => {
  $.log("开始执行网络查询...");

  // 1. 基础信息获取
  const ssid = $network.wifi.ssid || "Cellular";
  const v4 = $network.v4.primaryAddress || "N/A";

  // 2. 并行执行查询 (增加强制超时控制)
  try {
    const results = await Promise.all([
      getDirectIP(),
      getProxyIP(),
      checkMedia()
    ]);

    const [direct, proxy, media] = results;

    // 3. 组装面板内容 (精简版，防止溢出)
    const panelStr = `直连: ${mask(direct.ip)} | ${direct.info}\n落地: ${mask(proxy.ip)} | ${proxy.info}\n流媒体: YT:${media[0]} NF:${media[1]} GPT:${media[2]}`;

    // 4. 组装通知内容 (详细版)
    const notifyStr = `SSID: ${ssid} | LAN: ${v4}\n\n直连: ${mask(direct.ip)} (${direct.info})\n落地: ${mask(proxy.ip)} (${proxy.info})\n\nYT: ${media[0]} | NF: ${media[1]} | GPT: ${media[2]}`;

    // 5. 根据环境输出
    if (typeof $panel !== "undefined") {
      // 必须严格遵守 Surge 面板的返回格式
      $done({
        title: `网络: ${ssid}`,
        content: panelStr,
        icon: "network",
        "icon-color": "#5AC8FA"
      });
    } else {
      $.msg("网络信息 𝕏", `落地: ${proxy.info}`, notifyStr);
      $done();
    }
  } catch (err) {
    $.log("执行出错: " + err);
    $done();
  }
})();

// ======= 查询模块 =======

function getDirectIP() {
  return new Promise(resolve => {
    $httpClient.get("https://httpbin.org/ip", (err, resp, data) => {
      try {
        const ip = JSON.parse(data).origin.split(',')[0];
        resolve({ ip: ip, info: "直连" });
      } catch (e) {
        resolve({ ip: "未知", info: "超时" });
      }
    });
  });
}

function getProxyIP() {
  return new Promise(resolve => {
    $httpClient.get("http://ip-api.com/json/?lang=zh-CN", (err, resp, data) => {
      try {
        const info = JSON.parse(data);
        resolve({ ip: info.query, info: info.country });
      } catch (e) {
        resolve({ ip: "未知", info: "超时" });
      }
    });
  });
}

function checkMedia() {
  const list = [
    { url: "https://www.youtube.com/premium", key: "Premium" },
    { url: "https://www.netflix.com/title/81215561", key: "Netflix" },
    { url: "https://ios.chat.openai.com/public-api/mobile/server_status", key: "200" }
  ];
  return Promise.all(list.map(item => {
    return new Promise(resolve => {
      $httpClient.get({ url: item.url, timeout: 2500 }, (err, resp, data) => {
        resolve(!err && data && data.includes(item.key) ? "✅" : "❌");
      });
    });
  }));
}

// ======= 工具模块 =======
function mask(ip) {
  if (!ip || ip === "未知") return ip;
  const parts = ip.split('.');
  return parts.length === 4 ? `${parts[0]}.${parts[1]}.*.*` : ip;
}

function Env(name) {
  this.name = name;
  this.log = (m) => console.log(`[${this.name}] ${m}`);
  this.msg = (t, s, m) => $notification.post(t, s, m);
}
