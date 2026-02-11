/*
Surge 万能抓视频脚本 V5.6 (复制+跳转双修复版)
功能：性能过滤、存储限2条、1分钟清理、强制长按复制、稳定跳转
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

    // --- 逻辑 C：存储重复判断 ---
    let isExist = history.some(item => item.url === videoUrl);
    if (isExist) {
        log("🚫 存储中已存在相同链接，跳过通知");
        return;
    }

    // 更新状态
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
    // 🚀 跳转与复制逻辑修复核心
    // =====================
    // 1. 跳转用：必须编码，防止特殊字符截断协议
    let encodedUrl = encodeURIComponent(videoUrl);
    let vlcUrl = "vlc-x-callback://x-callback-url/stream?url=" + encodedUrl;
    
    // 2. 备用跳转方案（如果 x-callback 不起作用，请尝试切换为这个）
    // let vlcUrl = "vlc://" + encodedUrl;

    // 3. 复制用：直接使用原始 videoUrl 字符串
    $notification.post(
      title,
      "👉 点击跳转播放 | 🕒 1分钟后清理",
      "长按通知可直接【复制】视频链接\n" + videoUrl,
      { 
        "open-url": vlcUrl,      // 点击触发跳转
        "copy-output": videoUrl  // 强制指定长按复制的内容为原始链接
      }
    );
    log(`✅ 捕获成功 | 链接: ${videoUrl}`);
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
