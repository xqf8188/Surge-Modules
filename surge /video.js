/*
Surge 万能抓视频脚本 V4.0 (防抖优化版)
功能：性能过滤、5秒防抖(解决重复通知)、允许重复抓取、VLC跳转+长按复制
*/

// =====================
// 1. 初始化与内存缓存
// =====================
const url = $request.url;
const method = $request.method;
const body = (typeof $response !== 'undefined' && $response.body) ? $response.body : "";
const contentType = (typeof $response !== 'undefined' && $response.headers) ? ($response.headers['Content-Type'] || $response.headers['content-type'] || "") : "";

const HISTORY_KEY = "VideoCatch_History";
const MAX_HISTORY = 100;

// 内存缓存：用于实现 5 秒短效防抖，解决同一个视频连续跳两次通知的问题
if (typeof globalThis.cacheNotified === 'undefined') {
    globalThis.cacheNotified = {};
}

let history = JSON.parse($persistentStore.read(HISTORY_KEY) || "[]");

function log(msg) { console.log("🎬 [VideoCatch] " + msg); }

// =====================
// 2. 核心处理函数
// =====================
function processVideo(title, videoUrl) {
    // 过滤分片：防止 TS 或 m4s 切片刷屏
    if (videoUrl.includes(".ts") || videoUrl.includes("seg-") || videoUrl.match(/index_\d+\.m3u8/) || videoUrl.includes(".m4s")) {
        return;
    }

    // --- 核心逻辑：5秒短效防抖 ---
    let now = Date.now();
    // 如果该链接在过去 5000 毫秒内已经通知过，则直接拦截，不再跳通知
    if (globalThis.cacheNotified[videoUrl] && (now - globalThis.cacheNotified[videoUrl] < 10000)) {
        log("🚫 5秒内重复请求，已防抖拦截一次通知");
        return;
    }
    // 更新最后一次通知的时间戳
    globalThis.cacheNotified[videoUrl] = now;

    // 保存/更新历史记录（将该视频置顶）
    let index = history.findIndex(item => item.url === videoUrl);
    if (index !== -1) history.splice(index, 1);
    history.unshift({
        title: title,
        url: videoUrl,
        time: new Date().toLocaleString('zh-CN', { hour12: false })
    });
    if (history.length > MAX_HISTORY) history = history.slice(0, MAX_HISTORY);
    $persistentStore.write(JSON.stringify(history), HISTORY_KEY);

    // 发送通知
    // 跳转协议保持原样以确保播放成功率
    let vlcUrl = "vlc://" + videoUrl;
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
// 3. 性能过滤器
// =====================
// 排除静态资源请求，极大降低 CPU 开销
if (url.match(/\.(png|jpg|jpeg|gif|webp|zip|gz|woff|ttf|css|js|svg)/i)) {
    $done({});
}

// =====================
// 4. 捕获流程
// =====================

// A. 匹配 URL 后缀
if (url.match(/\.(mp4|m3u8)(\?.*)?$/i)) {
    let type = url.includes("m3u8") ? "📺 M3U8" : "🎥 MP4";
    processVideo(`${type} 捕获成功`, url);
}

// B. 扫描响应体 (仅限 JSON/Text 类型)
else if (contentType.match(/(json|text|javascript)/i)) {
    try {
        if (body && body.length < 512000) { // 限制 500KB 以下才解析
            let matches = body.match(/https?:\/\/[^"'\s]+\.(mp4|m3u8)(?:[\w\.\-\?&=\/!%]*)/g);
            if (matches) {
                [...new Set(matches)].forEach(v => processVideo("📡 API 视频捕获", v));
            }
        }
    } catch (e) {}
}

// C. 特定路径匹配
if (url.match(/(mfpt8g\.com|vdmk|dlmk|decrypt)/)) {
    processVideo("🔐 加密视频捕获", url);
}

$done({});
