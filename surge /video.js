/*
Surge 万能抓视频脚本 V4.2 (跨阶段防抖版)
功能：性能过滤、核心路径防抖、彻底解决请求/响应重复通知、VLC跳转+长按复制
*/

const url = $request.url;
const isResponse = typeof $response !== "undefined";
const body = isResponse ? $response.body : "";
const contentType = isResponse ? ($response.headers['Content-Type'] || $response.headers['content-type'] || "") : "";

const HISTORY_KEY = "VideoCatch_History";
const LAST_URL_KEY = "VideoCatch_LastURL"; // 用于跨阶段记录最后抓取的URL
const LAST_TIME_KEY = "VideoCatch_LastTime"; // 用于跨阶段记录最后抓取的时间
const MAX_HISTORY = 100;

let history = JSON.parse($persistentStore.read(HISTORY_KEY) || "[]");

function log(msg) { console.log("🎬 [VideoCatch] " + msg); }

// =====================
// 核心处理函数
// =====================
function processVideo(title, videoUrl) {
    // 1. 基础过滤：分片文件不抓取
    if (videoUrl.includes(".ts") || videoUrl.includes("seg-") || videoUrl.match(/index_\d+\.m3u8/) || videoUrl.includes(".m4s")) {
        return;
    }

    // --- 核心逻辑：跨阶段防抖 ---
    let cleanUrl = videoUrl.split('?')[0];
    let lastUrl = $persistentStore.read(LAST_URL_KEY);
    let lastTime = parseInt($persistentStore.read(LAST_TIME_KEY) || "0");
    let now = Date.now();

    // 如果 5 秒内抓取的是同一个核心路径，直接拦截
    if (cleanUrl === lastUrl && (now - lastTime < 5000)) {
        log("🚫 跨阶段防抖：已拦截重复通知");
        return;
    }

    // 更新持久化缓存
    $persistentStore.write(cleanUrl, LAST_URL_KEY);
    $persistentStore.write(now.toString(), LAST_TIME_KEY);

    // 2. 保存/更新历史记录
    let index = history.findIndex(item => item.url === videoUrl);
    if (index !== -1) history.splice(index, 1);
    history.unshift({
        title: title,
        url: videoUrl,
        time: new Date().toLocaleString('zh-CN', { hour12: false })
    });
    if (history.length > MAX_HISTORY) history = history.slice(0, MAX_HISTORY);
    $persistentStore.write(JSON.stringify(history), HISTORY_KEY);

    // 3. 发送通知
    let vlcUrl = videoUrl.replace(/^http/, "vlc");
    $notification.post(
        title,
        "点击跳转 VLC | 长按通知可复制链接",
        `抓取时间：${new Date().toLocaleTimeString()}\n${videoUrl}`,
        { 
            "url": vlcUrl, 
            "open-url": vlcUrl, 
            "copy-output": videoUrl 
        }
    );
    log(`✅ 捕获成功：${videoUrl}`);
}

// =====================
// 性能过滤器
// =====================
if (url.match(/\.(png|jpg|jpeg|gif|webp|zip|gz|woff|ttf|css|js|svg)/i)) {
    $done({});
}

// =====================
// 捕获流程
// =====================

// A. URL 匹配 (通常发生在 Request 阶段)
if (url.match(/\.(mp4|m3u8)(\?.*)?$/i)) {
    let type = url.includes("m3u8") ? "📺 M3U8" : "🎥 MP4";
    processVideo(`${type} 捕获成功`, url);
}

// B. Body 扫描 (仅在 Response 阶段且类型匹配时)
if (isResponse && contentType.match(/(json|text|javascript)/i)) {
    try {
        if (body && body.length < 512000) {
            let matches = body.match(/https?:\/\/[^\s"'<>%]+?\.(mp4|m3u8)(?:[\w\.\-\?&=\/!%]*)/gi);
            if (matches) {
                [...new Set(matches)].forEach(v => processVideo("📡 API 视频捕获", v));
            }
        }
    } catch (e) {}
}

// C. 特殊路径
if (url.match(/(mfpt8g\.com|vdmk|dlmk|decrypt)/)) {
    processVideo("🔐 加密视频捕获", url);
}

$done({});
