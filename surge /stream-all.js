/*
 * 整合脚本：网络信息 (极速版)
 * 优化：大幅提升检测速度，增加超时控制，修复 Surge 策略显示
 */

const NAME = 'network-info-fast'
const $ = new Env(NAME)
const TIMEOUT = 3000 // 每个请求强制 3 秒超时

let arg = (typeof $argument != 'undefined') ? Object.fromEntries($argument.split('&').map(item => item.split('='))) : {}
const REQUEST_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/94.0.4606.61 Safari/537.36',
}

!(async () => {
  // 1. 基础信息同步获取（不耗时）
  let SSID = '', LAN = ''
  if (typeof $network !== 'undefined') {
    const v4 = $.lodash_get($network, 'v4.primaryAddress')
    if (arg.SSID == 1) SSID = `SSID: ${$.lodash_get($network, 'wifi.ssid')}\n\n`
    if (v4 && arg.LAN == 1) LAN = `LAN: ${v4}\n\n`
  }

  // 2. 并发执行检测 (添加超时控制)
  const results = await Promise.allSettled([
    check_youtube_premium(),
    check_netflix(),
    check_chatgpt(),
    testDisneyPlus(),
    getProxyInfo(), 
    getDirectInfo(),
    getSurgeActivePolicy()
  ])

  // 映射结果
  const [yt, nf, gpt, disney, proxyData, directData, surgePolicy] = results.map(r => r.status === 'fulfilled' ? r.value : null)

  // 3. 策略名逻辑优化
  let PROXY_DISPLAY = `策略: ${surgePolicy || (typeof $session !== 'undefined' ? $session.proxy : '检测中...')}\n`

  // 4. 组装内容
  const title = `网络信息 & 流媒体`
  const media_content = [
    yt || "YouTube: 超时",
    nf || "Netflix: 超时",
    gpt || "ChatGPT: 超时",
    disney || "Disney+: 超时"
  ].join('\n')
  
  const content = `${SSID}${LAN}${media_content}\n` + 
            '—'.repeat(20) + '\n' +
            `${PROXY_DISPLAY}` +
            `落地 IP: ${proxyData?.ip || '-'}\n${proxyData?.info || '获取中...'}\n` +
            `直连 IP: ${directData?.ip || '-'}` +
            `\n执行时间: ${new Date().toTimeString().split(' ')[0]}`

  if (typeof $input != 'undefined' && $input.purpose === 'panel') {
    $done({ title, content, icon: "network", "icon-color": "#5AC8FA" })
  } else {
    $.msg(title, "", content)
    $.done()
  }
})().catch(e => { $.logErr(e); $.done() })

// ================= 极速版工具函数 =================

function fastGet(url) {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject('Timeout'), TIMEOUT);
        $httpClient.get({url, headers: REQUEST_HEADERS}, (err, res, data) => {
            clearTimeout(timer);
            if (err) reject(err); else resolve({res, data});
        });
    });
}

async function check_chatgpt() {
    try {
        const { data } = await fastGet('https://chat.openai.com/cdn-cgi/trace');
        let reg = data?.match(/loc=([A-Z]{2})/)?.[1] || '未知';
        return `ChatGPT: 已解锁 ➟ ${reg}`;
    } catch { return 'ChatGPT: 检测失败 🚫'; }
}

async function check_youtube_premium() {
    try {
        const { data } = await fastGet('https://www.youtube.com/premium');
        let m = data?.match(/"countryCode":"(.*?)"/)?.[1] || 'US';
        return `YouTube: ${data?.indexOf('not available') === -1 ? '已解锁 ➟ ' + m : '不支持'}`;
    } catch { return 'YouTube: 超时'; }
}

async function check_netflix() {
    try {
        const { res } = await fastGet('https://www.netflix.com/title/81280792');
        let c = (res.headers['x-originating-url'] || '').split('/')[3]?.split('-')[0].toUpperCase() || 'US';
        return `Netflix: 已完整解锁 ➟ ${c}`;
    } catch { return 'Netflix: 不支持/超时'; }
}

async function testDisneyPlus() {
    try {
        const { data } = await fastGet('https://www.disneyplus.com/');
        let m = data?.match(/Region: ([A-Za-z]{2})/)?.[1] || 'US';
        return `Disney+: 已解锁 ➟ ${m}`;
    } catch { return 'Disney+: 未支持 🚫'; }
}

async function getProxyInfo() {
    try {
        const { data } = await fastGet('http://ip-api.com/json?lang=zh-CN');
        let obj = JSON.parse(data);
        let flag = obj.countryCode.toUpperCase().replace(/./g, c => String.fromCodePoint(c.charCodeAt(0) + 127397));
        return { ip: obj.query, info: `位置: ${flag} ${obj.country} ${obj.regionName}\n运营商: ${obj.isp}` };
    } catch { return { ip: '-', info: '获取失败' }; }
}

async function getDirectInfo() {
    try {
        const { data } = await fastGet('https://api.bilibili.com/x/web-interface/zone');
        return { ip: JSON.parse(data || '{}')?.data?.addr || '-' };
    } catch { return { ip: '-' }; }
}

async function getSurgeActivePolicy() {
    if (typeof $surge === 'undefined') return null;
    return new Promise((resolve) => {
        $httpAPI("GET", "/v1/requests/recent", null, (data) => {
            const regexp = /ip-api\.com|ipinfo\.io|api-ipv4\.ip\.sb/
            const request = data?.requests?.slice(0, 10).find(i => regexp.test(i.URL));
            resolve(request?.policyName || null);
        });
        setTimeout(() => resolve(null), 2000); // 策略回溯最多等 2 秒
    });
}

function Env(t,e){class s{constructor(t){this.env=t}get(t,e){$httpClient.get(t,e)}}return new class{constructor(t,e){this.name=t,this.http=new s(this),Object.assign(this,e)}log(...t){console.log(t.join("\n"))}msg(e,s,a){$notification.post(e,s,a)}lodash_get(t,e,s){const a=e.replace(/\[(\d+)\]/g,".$1").split(".");let r=t;for(const t of a)if(r=Object(r)[t],void 0===r)return s;return r}done(t={}){$done(t)}}(t,e)}
