/*
Surge 万能抓视频脚本 V4.1 (路径级防抖版)
功能：性能过滤、核心路径防抖(彻底解决重复通知)、允许重复抓取、VLC跳转+长按复制
*/

// =====================
// 1. 初始化与内存缓存
// =====================
const url = $request.url;
const body = (typeof $response !== 'undefined' && $response.body) ? $response.body : "";
const contentType = (typeof $response !== 'undefined' && $response.headers) ? ($response.headers['Content-Type'] || $response.headers['content-type'] || "") : "";

const HISTORY_KEY = "VideoCatch_History";
const MAX_HISTORY = 100;

// 使用 globalThis 确保跨请求持久化
if (typeof globalThis.cacheNotified === 'undefined') {
    globalThis.cacheNotified = {};
}

let history = JSON.parse($persistentStore.read(HISTORY_KEY) || "[]");

function log(msg) { console.log("🎬 [VideoCatch] " + msg); }

// =====================
// 2. 核心处理函数
// =====================
function processVideo(title, videoUrl) {
    // 过滤分片：防止切片刷屏
    if (videoUrl.includes(".ts") || videoUrl.includes("seg-") || videoUrl.match(/index_\d+\.m3u8/) || videoUrl.includes(".m4s")) {
        return;
  }

    // --- 核心改进：基于核心路径的 5 秒防抖 ---
    // 去掉 URL 中 ? 后面的参数再进行对比，防止带时间戳的链接绕过去重
    let cleanUrl = videoUrl.split('?')[0];
    let now = Date.now();
    
    if (globalThis.cacheNotified[cleanUrl] && (now - globalThis.cacheNotified[cleanUrl] < 5000)) {
        log("🚫 路径级防抖：拦截重复通知");
        return;
    }
    globalThis.cacheNotified[cleanUrl] = now;

    // 保存/更新历史记录
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
    let vlcUrl = videoUrl.replace(/^http/, "vlc"); // 还原最原始的 replace 协议转换
    
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

// B. 扫描响应体 (仅限文本类型)
else if (contentType.match(/(json|text|javascript)/i)) {
    try {
        if (body && body.length < 512000) {
            let matches = body.match(/https?:\/\/[^\s"'<>%]+?\.(mp4|m3u8)(?:[\w\.\-\?&=\/!%]*)/gi);
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
