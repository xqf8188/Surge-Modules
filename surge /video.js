/*
Surge 万能抓视频脚本 V5.3 (精简存储版)
功能：性能过滤、路径永久去重、单次进入锁定、存储只保留 5 条、5 分钟自动清理
*/

const url = $request.url;
const isResponse = typeof $response !== "undefined";
const body = isResponse ? $response.body : "";
const contentType = isResponse ? ($response.headers['Content-Type'] || $response.headers['content-type'] || "") : "";

// =====================
// 持久化储存配置
// =====================
const HISTORY_KEY = "VideoCatch_History";
const NOTIFIED_LIST_KEY = "VideoCatch_NotifiedPathList"; 
const LOCK_TIME_KEY = "VideoCatch_ActionLock";
const MAX_HISTORY = 2;       // 核心改动：历史记录只保留 5 个
const EXPIRE_MINUTES = 1;    // 5 分钟后自动判定为过期

let history = JSON.parse($persistentStore.read(HISTORY_KEY) || "[]");
let notifiedPaths = JSON.parse($persistentStore.read(NOTIFIED_LIST_KEY) || "[]");

function log(msg) { console.log("🎬 [VideoCatch] " + msg); }

// =====================
// 核心处理函数
// =====================
function processVideo(title, videoUrl) {
    // 1. 基础过滤
    if (videoUrl.includes(".ts") || videoUrl.includes("seg-") || videoUrl.match(/index_\d+\.m3u8/) || videoUrl.includes(".m4s")) {
        return;
    }

    let now = Date.now();

    // --- 逻辑 A：自动清理过期历史 (5分钟) ---
    let beforeCount = history.length;
    history = history.filter(item => {
        if (!item.timestamp) return true;
        return (now - item.timestamp) < (EXPIRE_MINUTES * 60 * 1000);
    });
    if (history.length < beforeCount) {
        log(`🧹 自动清理：已删除过期的历史记录`);
    }

    // --- 逻辑 B：单次操作锁定 (10秒内只允许抓一个) ---
    let lastLockTime = parseInt($persistentStore.read(LOCK_TIME_KEY) || "0");
    if (now - lastLockTime < 10000) {
        return;
    }

    // --- 逻辑 C：路径级永久去重 (同视频只抓一次) ---
    let cleanUrl = videoUrl.split('?')[0];
    if (notifiedPaths.includes(cleanUrl)) {
        log("🚫 该视频已抓取过，不再通知");
        return;
    }

    // 更新状态
    $persistentStore.write(now.toString(), LOCK_TIME_KEY);
    notifiedPaths.push(cleanUrl);
    if (notifiedPaths.length > 500) notifiedPaths.shift();
    $persistentStore.write(JSON.stringify(notifiedPaths), NOTIFIED_LIST_KEY);

    // 2. 保存历史记录 (强制只保留最近 5 条)
    let index = history.findIndex(item => item.url === videoUrl);
    if (index !== -1) history.splice(index, 1);
    
    history.unshift({
        title: title,
        url: videoUrl,
        time: new Date().toLocaleString('zh-CN', { hour12: false }),
        timestamp: now 
    });

    // 强制截取前 5 条
    if (history.length > MAX_HISTORY) {
        history = history.slice(0, MAX_HISTORY);
    }
    $persistentStore.write(JSON.stringify(history), HISTORY_KEY);

    // 3. 发送通知
    let vlcUrl = videoUrl.replace(/^http/, "vlc");
    $notification.post(
      title,
      "✅ 捕获成功 | 历史仅留5条 | 5分后清理",
      videoUrl,
      { 
        "url": vlcUrl, 
        "open-url": vlcUrl, 
        "copy-output": videoUrl 
      }
    );
    log(`✅ 成功抓取：${videoUrl}`);
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
if (url.match(/\.(mp4|m3u8)(\?.*)?$/i)) {
    let type = url.includes("m3u8") ? "📺 M3U8" : "🎥 MP4";
    processVideo(`${type} 捕获成功`, url);
} else if (isResponse && contentType.match(/(json|text|javascript)/i)) {
    try {
        if (body && body.length < 512000) {
            let matches = body.match(/https?:\/\/[^\s"'<>%]+?\.(mp4|m3u8)(?:[\w\.\-\?&=\/!%]*)/gi);
            if (matches) {
                processVideo("📡 API 视频捕获", matches[0]);
            }
        }
    } catch (e) {}
}

$done({});
