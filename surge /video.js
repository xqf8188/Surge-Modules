/*
Surge 万能抓视频脚本 V2.0 (性能优化版)
功能：捕获视频、去重通知、过滤切片、跳转 VLC/复制链接
*/

const { url, method, responseHeaders, body } = $request;
const isResponse = typeof $response !== "undefined";

// =====================
// 1. 配置与持久化
// =====================
const HISTORY_KEY = "VideoCatch_History";
const NOTIFIED_KEY = "VideoCatch_Notified";
const MAX_HISTORY = 80;

let history = JSON.parse($persistentStore.read(HISTORY_KEY) || "[]");
let notified = JSON.parse($persistentStore.read(NOTIFIED_KEY) || "[]");

// =====================
// 2. 静态过滤器 (核心优化)
// =====================
// 排除常见的干扰项，减少 CPU 消耗
if (url.match(/\.(ts|jpg|jpeg|png|gif|css|js|woff|ttf|jsonp)/i)) {
    $done({});
}

// =====================
// 3. 核心处理逻辑
// =====================
function log(msg) { console.log("🎬 [VideoCatch] " + msg); }

function saveAndNotify(title, videoUrl) {
    // 去重逻辑
    if (notified.includes(videoUrl)) return;
    
    // 过滤可能的 M3U8 分片序号链接 (通常包含大量数字串)
    if (videoUrl.includes("seg-") || videoUrl.match(/\/(\d+)\.ts/)) return;

    // 存储
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

    // 通知推送
    let vlcUrl = "vlc://" + videoUrl;
    $notification.post(
        title, 
        "点击跳转 VLC | 长按通知复制链接", 
        `地址：${videoUrl}`, 
        { "open-url": vlcUrl, "copy-output": videoUrl }
    );
    log(`✅ 捕获成功: ${title}`);
}

// =====================
// 4. 捕获流程
// =====================

// 策略 A: 直接从 URL 识别
if (url.match(/\.(mp4|m3u8)(\?.*)?$/i)) {
    let type = url.includes("m3u8") ? "📺 M3U8" : "🎥 MP4";
    saveAndNotify(`${type} 自动捕获`, url);
}

// 策略 B: 从响应体 (JSON/Text) 识别
else if (isResponse && body) {
    const contentType = ($response.headers['Content-Type'] || $response.headers['content-type'] || "");
    
    // 只处理文本类 Body，避免解析二进制流导致的卡顿
    if (contentType.match(/(json|text|javascript|application\/vnd\.apple\.mpegurl)/i)) {
        try {
            // 正则匹配所有 http(s) 开头，mp4/m3u8 结尾的字符串
            const regex = /https?:\/\/[^\s"'<>%]+?\.(mp4|m3u8)(?:[\w\.\-\?&=\/!%]*)/gi;
            let matches = body.match(regex);
            
            if (matches) {
                let uniqueMatches = [...new Set(matches)];
                uniqueMatches.forEach(v => {
                    saveAndNotify("📡 深度扫描捕获", v);
                });
            }
        } catch (e) {
            log("解析 Body 出错: " + e);
        }
    }
}

$done({});
