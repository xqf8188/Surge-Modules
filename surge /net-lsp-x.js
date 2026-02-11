/*
 * 网络信息 𝕏 - Surge 稳定版 (修正面板未知问题)
 */

const $ = new Env("网络信息 𝕏");

// 主逻辑采用更激进的超时策略
(async () => {
  // 1. 基础信息立即获取 (非异步)
  const ssid = $network.wifi.ssid || "蜂窝数据";
  const v4 = $network.v4.primaryAddress || "N/A";

  // 2. 封装查询，确保 3 秒内无论如何都得返回给面板
  const timeoutPromise = new Promise((resolve) => {
    setTimeout(() => resolve("timeout"), 3500); 
  });

  const fetchPromise = Promise.all([
    getDirectIP(),
    getProxyIP(),
    checkMedia()
  ]);

  try {
    const result = await Promise.race([fetchPromise, timeoutPromise]);

    if (result === "timeout" || !result) {
      throw new Error("Timeout");
    }

    const [direct, proxy, media] = result;

    // 3. 组装显示
    const panelStr = `直连: ${mask(direct.ip)} | ${direct.info}\n落地: ${mask(proxy.ip)} | ${proxy.info}\n流媒体: YT:${media[0]} NF:${media[1]} GPT:${media[2]}`;
    const notifyStr = `SSID: ${ssid} | LAN: ${v4}\n\n直连: ${mask(direct.ip)} (${direct.info})\n落地: ${mask(proxy.ip)} (${proxy.info})\n\nYT: ${media[0]} | NF: ${media[1]} | GPT: ${media[2]}`;

    if (typeof $panel !== "undefined") {
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
    // 如果超时或出错，至少把已知的信息显示出来，不显示“未知”
    if (typeof $panel !== "undefined") {
      $done({
        title: `网络: ${ssid}`,
        content: `基础信息已获取，网络查询超时...\nLAN: ${v4}\n请点击面板重试`,
        icon: "exclamationmark.circle",
        "icon-color": "#FF3B30"
      });
    } else {
      $done();
    }
  }
})();

// ======= 查询模块 (保持你的逻辑，但增加严谨性) =======

function getDirectIP() {
  return new Promise(resolve => {
    $httpClient.get({url: "https://httpbin.org/ip", timeout: 2000}, (err, resp, data) => {
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
    // 强制增加 2.5秒超时，防止拖慢面板
    $httpClient.get({url: "http://ip-api.com/json/?lang=zh-CN", timeout: 2500}, (err, resp, data) => {
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
      $httpClient.get({ url: item.url, timeout: 2000 }, (err, resp, data) => {
        resolve(!err && data && data.includes(item.key) ? "✅" : "❌");
      });
    });
  }));
}

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
