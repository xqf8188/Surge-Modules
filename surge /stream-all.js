/*
 * 极速秒开版 v2.0
 * 调整：位置调换，IP信息置顶，流媒体信息置底
 */

const $ = new Env('NetworkInfo');
const TIMEOUT = 2000; 

!(async () => {
  // 1. 立即获取本地网络
  let ssid = (typeof $network !== 'undefined' && $network.wifi.ssid) ? `SSID: ${$network.wifi.ssid}\n` : '';
  
  // 2. 并发检测
  const results = await Promise.allSettled([
    httpGet('http://ip-api.com/json?lang=zh-CN'),
    httpGet('https://api.bilibili.com/x/web-interface/zone'),
    httpGet('https://chat.openai.com/cdn-cgi/trace'),
    httpGet('https://www.youtube.com/premium'),
    httpGet('https://www.netflix.com/title/81280792')
  ]);

  const [ipProxy, ipDirect, gpt, yt, nf] = results.map(r => r.status === 'fulfilled' ? r.value : null);

  // 3. 解析 IP 信息
  let proxyIP = '-', proxyLoc = '获取超时';
  if (ipProxy?.data) {
    const info = JSON.parse(ipProxy.data);
    proxyIP = info.query;
    const flag = info.countryCode.toUpperCase().replace(/./g, c => String.fromCodePoint(c.charCodeAt(0) + 127397));
    proxyLoc = `${flag} ${info.country} ${info.regionName}`;
  }
  const directIP = ipDirect?.data ? JSON.parse(ipDirect.data).data?.addr : '-';

  // 4. 解析流媒体信息
  const gptRes = gpt?.data?.match(/loc=([A-Z]{2})/)?.[1] || '关闭';
  const ytRes = yt?.data?.indexOf('not available') === -1 ? '已解锁' : '未解锁';
  const nfRes = nf?.res?.status === 200 ? '已解锁' : '未解锁';

  // 5. 组装面板 (调换顺序)
  const content = `${ssid}` +
    `落地 IP: ${proxyIP}\n位置: ${proxyLoc}\n` +
    `直连 IP: ${directIP}\n` +
    `—`.repeat(12) + `\n` +
    `ChatGPT: ${gptRes} | YouTube: ${ytRes}\n` +
    `Netflix: ${nfRes}\n` +
    `刷新时间: ${new Date().toLocaleTimeString()}`;

  $done({
    title: "网络信息检测",
    content: content,
    icon: "network",
    "icon-color": "#5AC8FA"
  });
})();

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject('Timeout'), TIMEOUT);
    $httpClient.get({ url, headers: { 'User-Agent': 'Mozilla/5.0' } }, (err, res, data) => {
      clearTimeout(timer);
      if (err) reject(err); else resolve({ res, data });
    });
  });
}

function Env(n) {
  return {
    name: n,
    done: (o) => $done(o)
  };
}
