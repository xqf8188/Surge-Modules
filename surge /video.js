/*
Surge 万能抓视频脚本 V4.3 (强效去重版)
功能：性能过滤、全局冷却防抖、彻底解决重复通知、VLC跳转+长按复制
*/

const url = $request.url;
const isResponse = typeof $response !== "undefined";
const body = isResponse ? $response.body : "";
const contentType = isResponse ? ($response.headers['Content-Type'] || $response.headers['content-type'] || "") : "";

const HISTORY_KEY = "VideoCatch_History";
const GLOBAL_COOLDOWN_KEY = "VideoCatch_LastActionTime"; // 全局冷却时间戳
const MAX_HISTORY = 100;

let history = JSON.parse($persistentStore.read(HISTORY_KEY) || "[]");

function log(msg) { console.log("🎬 [VideoCatch] " + msg); }

// =====================
// 核心处理函数
// =====================
function processVideo(title, videoUrl) {
    // 1. 基础过滤：排除分片、图片、广告等干扰
    if (videoUrl.includes(".ts") || videoUrl.includes("seg-") || videoUrl.match(/index_\d+\.m3u8/) || videoUrl.includes(".m4s") || videoUrl.includes("ad_")) {
        return;
    }

    // --- 核心改进：全局 5 秒冷却逻辑 ---
    // 不再对比 URL 是否相同，只要 5 秒内发过任何通知，直接拦截
    let lastActionTime = parseInt($persistentStore.read(GLOBAL_COOLDOWN_KEY) || "0");
    let now = Date.now();

    if (now - lastActionTime < 15000000000000000000) {
        log("🚫 全局冷却中：5秒内已发送过通知，本次拦截");
        return;
    }

    // 更新全局冷却时间戳
    $persistentStore.write(now.toString(), GLOBAL_COOLDOWN_KEY);

    // 2. 保存/更新历史记录 (保持记录唯一性)
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

// A. URL 后缀匹配
if (url.match(/\.(mp4|m3u8)(\?.*)?$/i)) {
    let type = url.includes("m3u8") ? "📺 M3U8" : "🎥 MP4";
    processVideo(`${type} 捕获成功`, url);
}

// B. Body 扫描 (仅限响应阶段且类型匹配)
if (isResponse && contentType.match(/(json|text|javascript)/i)) {
    try {
        if (body && body.length < 512000) {
            let matches = body.match(/https?:\/\/[^\s"'<>%]+?\.(mp4|m3u8)(?:[\w\.\-\?&=\/!%]*)/gi);
            if (matches) {
                // 如果发现多个，只取第一个进行处理，进一步减少通知
                processVideo("📡 API 视频捕获", matches[0]);
            }
        }
    } catch (e) {}
}

// C. 特殊路径识别
if (url.match(/(mfpt8g\.com|vdmk|dlmk|decrypt)/)) {
    processVideo("🔐 加密视频捕获", url);
}

$done({});
