/*
作者：keywos & Gemini
功能：ChatGPT / YouTube / Netflix / TikTok / Google 独立行详细检测
*/

const urlGPT = "http://chat.openai.com/cdn-cgi/trace";
const urlYoutube = "https://www.youtube.com/premium";
const urlNetflix = "https://www.netflix.com/title/81215561"; 
const urlTikTok = "https://www.tiktok.com/";
const urlGoogle = "https://www.google.com/search?q=ip";

// ChatGPT 支持列表
let tf=["T1","XX","AL","DZ","AD","AO","AG","AR","AM","AU","AT","AZ","BS","BD","BB","BE","BZ","BJ","BT","BA","BW","BR","BG","BF","CV","CA","CL","CO","KM","CR","HR","CY","DK","DJ","DM","DO","EC","SV","EE","FJ","FI","FR","GA","GM","GE","DE","GH","GR","GD","GT","GN","GW","GY","HT","HN","HU","IS","IN","ID","IQ","IE","IL","IT","JM","JP","JO","KZ","KE","KI","KW","KG","LV","LB","LS","LR","LI","LT","LU","MG","MW","MY","MV","ML","MT","MH","MR","MU","MX","MC","MN","ME","MA","MZ","MM","NA","NR","NP","NL","NZ","NI","NE","NG","MK","NO","OM","PK","PW","PA","PG","PE","PH","PL","PT","QA","RO","RW","KN","LC","VC","WS","SM","ST","SN","RS","SC","SL","SG","SK","SI","SB","ZA","ES","LK","SR","SE","CH","TH","TG","TO","TT","TN","TR","TV","UG","AE","US","UY","VU","ZM","BO","BN","CG","CZ","VA","FM","MD","PS","KR","TW","TZ","TL","GB"];

// 解析参数
let { titlediy, icon, iconerr, iconColor, iconerrColor } = parseArgs();

async function checkAll() {
    let results = await Promise.all([
        checkGPT(),
        checkYouTube(),
        checkNetflix(),
        checkTikTok(),
        checkGoogle()
    ]);

    let [gpt, yt, nf, tk, gg] = results;
    
    // 组装内容，每一项单独一行
    let content = `ChatGPT: ${gpt}\n` +
                  `YouTube: ${yt}\n` + 
                  `Netflix: ${nf}\n` + 
                  `TikTok: ${tk}\n` + 
                  `Google: ${gg}`;

    // 以 GPT 状态决定整体图标颜色
    let isOK = !gpt.includes("✖️");
    let iconUsed = isOK ? (icon || "safari.fill") : (iconerr || "exclamationmark.triangle.fill");
    let colUsed = isOK ? (iconColor || "#336FA9") : (iconerrColor || "#D65C51");

    $done({
        title: titlediy || '流媒体解锁详情',
        content: content,
        icon: iconUsed,
        'icon-color': colUsed
    });
}

// --- 各平台详细检测函数 ---

function checkGPT() {
    return new Promise(resolve => {
        $httpClient.get(urlGPT, (err, resp, data) => {
            if (err || !data) return resolve("✖️ 连接失败");
            let loc = data.split("\n").find(line => line.startsWith("loc=")).split("=")[1];
            let res = getCountryFlagEmoji(loc) + " " + loc;
            resolve(tf.indexOf(loc) !== -1 ? `✔️ ${res}` : `✖️ ${res} (不支持)`);
        });
    });
}

function checkYouTube() {
    return new Promise(resolve => {
        $httpClient.get(urlYoutube, (err, resp) => {
            if (err || !resp) return resolve("✖️ 检测失败");
            // YT 通过 header 里的全球唯一标识大致判断
            let loc = resp.headers["cf-ipcountry"] || "Global";
            if (resp.status === 200) {
                resolve(`✔️ 已解锁`); 
            } else {
                resolve("✖️ 不支持 Premium");
            }
        });
    });
}

function checkNetflix() {
    return new Promise(resolve => {
        $httpClient.get({url: urlNetflix, headers: {"User-Agent": "Mozilla/5.0"}}, (err, resp) => {
            if (err || !resp) return resolve("✖️ 检测失败");
            if (resp.status === 200) return resolve("✔️ 原生全解");
            if (resp.status === 404) return resolve("⚠️ 仅限自制剧");
            resolve("✖️ 被封锁");
        });
    });
}

function checkTikTok() {
    return new Promise(resolve => {
        $httpClient.get(urlTikTok, (err, resp) => {
            if (err || !resp) return resolve("✖️ 检测失败");
            // TikTok 响应头通常包含区域信息
            let loc = resp.headers["x-nf-client-connection-ip-country"] || resp.headers["cf-ipcountry"];
            if (resp.status === 200 || resp.status === 302) {
                resolve(`✔️ ${loc ? getCountryFlagEmoji(loc) + " " + loc : "已解锁"}`);
            } else {
                resolve("✖️ 不可用");
            }
        });
    });
}

function checkGoogle() {
    return new Promise(resolve => {
        $httpClient.get(urlGoogle, (err, resp, data) => {
            if (err || !resp) return resolve("✖️ 连接超时");
            // 尝试从 Google 搜索结果中提取地区
            let locMatch = data ? data.match(/IP address: .+\((.+)\)/) : null;
            let loc = locMatch ? locMatch[1] : "已连接";
            resolve(`✔️ ${loc}`);
        });
    });
}

// --- 工具函数 ---

function parseArgs() {
    let args = {};
    if (typeof $argument !== 'undefined') {
        $argument.split('&').forEach(item => {
            let [k, v] = item.split('=');
            if(k) args[k] = v;
        });
    }
    return {
        titlediy: args.title,
        icon: args.icon,
        iconerr: args.iconerr,
        iconColor: args['icon-color'],
        iconerrColor: args['iconerr-color']
    };
}

function getCountryFlagEmoji(countryCode) {
    if (!countryCode || countryCode.length !== 2) return "";
    if (countryCode.toUpperCase() === 'TW') countryCode = 'CN';
    const codePoints = countryCode.toUpperCase().split('').map(char => 127397 + char.charCodeAt());
    return String.fromCodePoint(...codePoints);
}

checkAll();
