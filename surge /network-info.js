/**
 * Surge 专用网络信息面板 (增强版)
 */

const arg = typeof $argument != 'undefined' ? Object.fromEntries($argument.split('&').map(item => item.split('='))) : {};
const config = {
    MASK: arg.MASK == 1,
    ORG: arg.ORG == 1,
    SSID: arg.SSID == 1
};

!(async () => {
    // 并行获取信息
    const [ipDirect, ipProxy] = await Promise.all([
        getIPInfo("http://cp.cloudflare.com/generate_204", "DIRECT"),
        getIPInfo("https://ip-api.com/json?lang=zh-CN", "PROXY")
    ]);

    let title = "网络诊断";
    let content = [];

    // SSID & 本地网络
    if (config.SSID && $network.wifi.ssid) {
        content.push(`📍 WiFi: ${$network.wifi.ssid}`);
    }

    // 直连 IP 栏
    const maskedDirect = maskIP(ipDirect.ip);
    content.push(`🏠 直连: ${maskedDirect} (CN)`);

    // 落地 IP 栏
    const maskedProxy = maskIP(ipProxy.ip);
    const isProxy = ipDirect.ip !== ipProxy.ip;
    
    if (isProxy) {
        content.push(`☁️ 落地: ${maskedProxy}`);
        content.push(`🌍 节点: ${ipProxy.addr}`);
        if (config.ORG) content.push(`🏢 运营: ${ipProxy.org}`);
    } else {
        content.push(`🛡️ 状态: 当前为直连环境`);
    }

    // 组装面板内容
    // Surge 面板支持简单的颜色格式控制，但主要依靠脚本返回的 title 和 content
    $done({
        title: isProxy ? `Proxy: ${ipProxy.countryCode}` : "Direct: China",
        content: content.join('\n'),
        icon: isProxy ? "airplane.circle.fill" : "house.fill",
        "icon-color": isProxy ? "#007AFF" : "#4CD964"
    });
})();

async function getIPInfo(url, type) {
    return new Promise((resolve) => {
        let options = { url: url, timeout: 5000 };
        if (type === "PROXY") options.headers = { "X-Surge-Skip-Scripting": "false" };

        $httpClient.get(options, (err, resp, body) => {
            if (err || !body) return resolve({ ip: "N/A", addr: "Unknown" });
            
            // 如果是 IP-API 接口
            if (url.includes("ip-api")) {
                try {
                    const data = JSON.parse(body);
                    resolve({
                        ip: data.query,
                        countryCode: data.countryCode,
                        addr: `${getFlag(data.countryCode)} ${data.country}`,
                        org: data.isp
                    });
                } catch (e) { resolve({ ip: "Error", addr: "" }); }
            } else {
                // 如果是 cloudflare 接口，只取 IP
                const ip = resp.headers['traceparent'] ? "Check Fail" : resp.headers['x-surge-remote-address'] || "Direct IP";
                resolve({ ip: ip });
            }
        });
    });
}

function maskIP(ip) {
    if (!ip || !config.MASK || ip === "N/A") return ip;
    return ip.split('.').slice(0, 2).concat(['*', '*']).join('.');
}

function getFlag(code) {
    if (!code) return "";
    return code.toUpperCase().replace(/./g, char => String.fromCodePoint(char.charCodeAt(0) + 127397));
}
