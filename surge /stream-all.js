/*
 * 极速秒开版：网络信息检测
 * 策略：放弃耗时的 Surge API 回溯，改用高并发竞速，首屏即出结果。
 */

const $ = new Env('NetworkInfo');
const TIMEOUT = 2000; // 极速超时，2秒内不出结果直接跳过

!(async () => {
  // 1. 立即获取本地网络（0延迟）
  let ssid = (typeof $network !== 'undefined' && $network.wifi.ssid) ? `SSID: ${$network.wifi.ssid}\n` : '';
  
  // 2. 核心检测：将所有网络请求置于竞速模式
  const results = await Promise.allSettled([
    httpGet('https://chat.openai.com/cdn-cgi/trace'),
    httpGet('https://www.youtube.com/premium'),
    httpGet('https://www.netflix.com/title/81280792'),
    httpGet('http://ip-api.com/json?lang=zh-CN'),
    httpGet('https://api.bilibili.com/x/web-interface/zone')
  ]);

  const [gpt, yt, nf, ipProxy, ipDirect] = results.map(r => r.status === 'fulfilled' ? r.value : null);

  // 3. 快速解析结果
  const gptRes = gpt?.data?.match(/loc=([A-Z]{2})/)?.[1] || '关闭';
  const ytRes = yt?.data?.indexOf('not available') === -1 ? '已解锁' : '未解锁';
  const nfRes = nf?.res?.status === 200 ? '已解锁' : '未解锁';
  
  let proxyIP = '-', proxyLoc = '获取超时';
  if (ipProxy?.data) {
    const info = JSON.parse(ipProxy.data);
    proxyIP = info.query;
    const flag = info.countryCode.toUpperCase().replace(/./g, c => String.fromCodePoint(c.charCodeAt(0) + 127397));
    proxyLoc = `${flag} ${info.country} ${info.regionName}`;
  }

  const directIP = ipDirect?.data ? JSON.parse(ipDirect.data).data?.addr : '-';

  // 4. 组装面板
  const content = `${ssid}` +
    `ChatGPT: ${gptRes} | YouTube: ${ytRes}\n` +
    `Netflix: ${nfRes}\n` +
    `—`.repeat(12) + `\n` +
    `落地 IP: ${proxyIP}\n位置: ${proxyLoc}\n` +
    `直连 IP: ${directIP}\n` +
    `刷新时间: ${new Date().toLocaleTimeString()}`;

  $done({
    title: "网络信息检测",
    content: content,
    icon: "network",
    "icon-color": "#007AFF"
  });
})();

// 极速请求包装
function httpGet(url) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject('Timeout'), TIMEOUT);
    $httpClient.get({ url, headers: { 'User-Agent': 'Mozilla/5.0' } }, (err, res, data) => {
      clearTimeout(timer);
      if (err) reject(err); else resolve({ res, data });
    });
  });
}

// 简易环境适配
function Env(n) {
  return {
    name: n,
    done: (o) => $done(o),
    log: (m) => console.log(m)
  };
}
