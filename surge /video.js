/*
Surge 万能抓视频脚本 V3.0 (跳转修复版)
*/

const { url, responseHeaders, body } = $request;
const isResponse = typeof $response !== "undefined";

const HISTORY_KEY = "VideoCatch_History";
const NOTIFIED_KEY = "VideoCatch_Notified";
const MAX_HISTORY = 80;

let history = JSON.parse($persistentStore.read(HISTORY_KEY) || "[]");
let notified = JSON.parse($persistentStore.read(NOTIFIED_KEY) || "[]");

// 静态过滤器：排除非视频请求
if (url.match(/\.(ts|jpg|jpeg|png|gif|css|js|woff|ttf|jsonp)/i)) {
    $done({});
}

function log(msg) { console.log("🎬 [VideoCatch] " + msg); }

function saveAndNotify(title, videoUrl) {
    if (notified.includes(videoUrl)) return;
    // 过滤 M3U8 切片干扰
    if (videoUrl.includes("seg-") || videoUrl.match(/\/(\d+)\.ts/)) return;

    notified.push(videoUrl);
    if (notified.length > 150) notified.shift();
    $persistentStore.write(JSON.stringify(notified), NOTIFIED_KEY);

    let newItem = {
        title: title,
        url: videoUrl,
        time: new Date().toLocaleString('zh-CN', { hour12: false })
    };
    history.unshift(newItem);
    if (history.length > MAX_HISTORY) history = history.slice(0, MAX_HISTORY);
    $persistentStore.write(JSON.stringify(history), HISTORY_KEY);

    // --- 跳转逻辑修复核心 ---
    // 1. 对原始 URL 进行编码，防止特殊字符截断协议
    let encodedUrl = encodeURIComponent(videoUrl);
    let vlcUrl = "vlc://" + encodedUrl;
    
    // 2. 双参数推送，确保 100% 触发跳转
    $notification.post(
        title, 
        "点击立即跳转 VLC 播放", 
        `捕获地址: ${videoUrl}`, 
        { 
            "open-url": vlcUrl,   // Surge 官方推荐字段
            "url": vlcUrl,        // 兼容性字段
            "copy-output": videoUrl // 长按通知可复制原始链接
        }
    );
    log(`✅ 捕获成功并发送通知: ${title}`);
}

// 捕获逻辑
if (url.match(/\.(mp4|m3u8)(\?.*)?$/i)) {
    let type = url.includes("m3u8") ? "📺 M3U8" : "🎥 MP4";
    saveAndNotify(`${type} 自动捕获`, url);
} else if (isResponse && body) {
    const contentType = ($response.headers['Content-Type'] || $response.headers['content-type'] || "");
    if (contentType.match(/(json|text|javascript|application\/vnd\.apple\.mpegurl)/i)) {
        try {
            const regex = /https?:\/\/[^\s"'<>%]+?\.(mp4|m3u8)(?:[\w\.\-\?&=\/!%]*)/gi;
            let matches = body.match(regex);
            if (matches) {
                [...new Set(matches)].forEach(v => saveAndNotify("📡 深度扫描捕获", v));
            }
        } catch (e) { log("解析错误: " + e); }
    }
}

$done({});
