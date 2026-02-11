/*
Surge 万能抓视频脚本 V3.5 (终极兼容版)
功能：性能过滤、去重、防切片干扰、原生协议跳转
*/

// =====================
// 1. 初始化与配置
// =====================
const url = $request.url;
const body = $response ? $response.body : null;
const HISTORY_KEY = "VideoCatch_History";
const NOTIFIED_KEY = "VideoCatch_Notified";
const MAX_HISTORY = 100;

let history = JSON.parse($persistentStore.read(HISTORY_KEY) || "[]");
let notified = JSON.parse($persistentStore.read(NOTIFIED_KEY) || "[]");

function log(msg) { console.log("🎬 [VideoCatch] " + msg); }

// =====================
// 2. 静态过滤器 (防止卡顿)
// =====================
if (url.match(/\.(ts|jpg|jpeg|png|gif|css|js|woff|ttf|jsonp|svg)/i)) {
    $done({});
}

// =====================
// 3. 核心处理函数
// =====================
function processVideo(title, videoUrl) {
    // 去重检测
    if (notified.includes(videoUrl)) return;
    
    // 过滤 M3U8 切片干扰 (关键：防止通知轰炸)
    if (videoUrl.includes("seg-") || videoUrl.match(/\/(\d+)\.ts/) || videoUrl.includes(".m4s")) return;

    // 保存历史记录
    notified.push(videoUrl);
    if (notified.length > 200) notified.shift();
    $persistentStore.write(JSON.stringify(notified), NOTIFIED_KEY);

    let newItem = {
        title: title,
        url: videoUrl,
        time: new Date().toLocaleString('zh-CN', { hour12: false })
    };
    history.unshift(newItem);
    if (history.length > MAX_HISTORY) history = history.slice(0, MAX_HISTORY);
    $persistentStore.write(JSON.stringify(history), HISTORY_KEY);

    // --- 跳转逻辑 (采用你原脚本最有效的 replace 方式) ---
    let vlcUrl = videoUrl.replace(/^http/, "vlc");

    $notification.post(
        title,
        "点击跳转 VLC | 链接已自动保存",
        videoUrl,
        { "open-url": vlcUrl, "url": vlcUrl } // 双字段保障跳转
    );
    log(`✅ 捕获并推送: ${title}`);
}

// =====================
// 4. 捕获逻辑流程
// =====================

// 策略 A: 识别 URL 后缀
if (url.match(/\.(mp4|m3u8)(\?.*)?$/i)) {
    let type = url.includes("m3u8") ? "📺 M3U8" : "🎥 MP4";
    processVideo(`${type} 捕获成功`, url);
}

// 策略 B: 扫描响应体 (JSON/Text)
else if (body) {
    try {
        // 匹配 http(s) 开头，mp4/m3u8 结尾的链接
        const regex = /https?:\/\/[^\s"'<>%]+?\.(mp4|m3u8)(?:[\w\.\-\?&=\/!%]*)/gi;
        let matches = body.match(regex);
        if (matches) {
            let uniqueMatches = [...new Set(matches)];
            uniqueMatches.forEach(v => {
                processVideo("📡 深度扫描捕获", v);
            });
        }
    } catch (e) {
        // 忽略非文本解析错误
    }
}

// 策略 C: 特定加密路径 (保留你原脚本的逻辑)
if (url.includes("mfpt8g.com") || url.includes("vdmk") || url.includes("dlmk") || url.includes("decrypt")) {
    processVideo("🔐 加密视频捕获", url);
}

$done({});
