/*
Surge 万能抓视频脚本 V5.5 (VLC 跳转修复版)
功能：性能过滤、存储限2条、1分钟清理、跳转增强
*/

const url = $request.url;
const isResponse = typeof $response !== "undefined";
const body = isResponse ? $response.body : "";
const contentType = isResponse ? ($response.headers['Content-Type'] || $response.headers['content-type'] || "") : "";

// =====================
// 持久化储存配置
// =====================
const HISTORY_KEY = "VideoCatch_History";
const LOCK_TIME_KEY = "VideoCatch_ActionLock";
const MAX_HISTORY = 2;       
const EXPIRE_MINUTES = 1;    

let history = JSON.parse($persistentStore.read(HISTORY_KEY) || "[]");

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

    // --- 逻辑 A：自动清理过期历史 ---
    history = history.filter(item => {
        return (now - (item.timestamp || 0)) < (EXPIRE_MINUTES * 60 * 1000);
    });

    // --- 逻辑 B：单次操作锁定 (5秒) ---
    let lastLockTime = parseInt($persistentStore.read(LOCK_TIME_KEY) || "0");
    if (now - lastLockTime < 5000) return;

    // --- 逻辑 C：重复性判断 ---
    let isExist = history.some(item => item.url === videoUrl);
    if (isExist) {
        log("🚫 存储中已存在相同链接，跳过通知");
        return;
    }

    // 更新锁定与存储
    $persistentStore.write(now.toString(), LOCK_TIME_KEY);
    history.unshift({
        title: title,
        url: videoUrl,
        time: new Date().toLocaleString('zh-CN', { hour12: false }),
        timestamp: now 
    });
    if (history.length > MAX_HISTORY) history = history.slice(0, MAX_HISTORY);
    $persistentStore.write(JSON.stringify(history), HISTORY_KEY);

    // =====================
    // 🚀 跳转修复核心
    // =====================
    // 1. 尝试使用 x-callback 协议（这是 iOS 上最稳定的唤起方式）
    let encodedUrl = encodeURIComponent(videoUrl);
    let vlcUrl = "vlc-x-callback://x-callback-url/stream?url=" + encodedUrl;
    
    // 2. 备用传统协议（如果 A 不行，Surge 也会尝试触发）
    // let backupVlcUrl = "vlc://" + encodedUrl;

    $notification.post(
      title,
      "点击立即跳转 VLC 播放",
      `1分钟后自动清理记录\n${videoUrl}`,
      { 
        "open-url": vlcUrl,    // Surge 5.x 推荐字段
        "url": vlcUrl,         // 兼容旧版字段
        "copy-output": videoUrl 
      }
    );
    log(`✅ 捕获成功并尝试跳转: ${videoUrl}`);
}

// =====================
// 逻辑触发器
// =====================
if (url.match(/\.(png|jpg|jpeg|gif|webp|zip|gz|woff|ttf|css|js|svg)/i)) {
    $done({});
}

if (url.match(/\.(mp4|m3u8)(\?.*)?$/i)) {
    processVideo("🎥 视频捕获成功", url);
} else if (isResponse && contentType.match(/(json|text|javascript)/i)) {
    try {
        if (body && body.length < 512000) {
            let matches = body.match(/https?:\/\/[^\s"'<>%]+?\.(mp4|m3u8)(?:[\w\.\-\?&=\/!%]*)/gi);
            if (matches) processVideo("📡 API 视频捕获", matches[0]);
        }
    } catch (e) {}
}

$done({});
