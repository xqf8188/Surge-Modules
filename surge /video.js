/*
Surge 万能抓视频脚本 V5.4 (动态重复抓取版)
功能：性能过滤、存储限2条、1分钟自动清理、支持同视频重进抓取（基于实时存储判断）
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
const MAX_HISTORY = 2;       // 存储只保留 2 个
const EXPIRE_MINUTES = 1;    // 1 分钟后自动删除

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

    // --- 逻辑 A：自动清理过期历史 (1分钟) ---
    let beforeCount = history.length;
    history = history.filter(item => {
        if (!item.timestamp) return true;
        return (now - item.timestamp) < (EXPIRE_MINUTES * 60 * 1000); //
    });
    if (history.length < beforeCount) {
        log(`🧹 自动清理：已删除 1 分钟前的过期记录`);
    }

    // --- 逻辑 B：单次操作锁定 (5秒内防止连跳) ---
    let lastLockTime = parseInt($persistentStore.read(LOCK_TIME_KEY) || "0");
    if (now - lastLockTime < 5000) {
        return;
    }

    // --- 逻辑 C：存储查重判断 (核心需求) ---
    // 判断当前存储里是否已经有了完全一样的链接
    let isExist = history.some(item => item.url === videoUrl); //
    if (isExist) {
        log("🚫 存储中已存在相同链接，跳过通知");
        return;
    }

    // 更新锁定时间
    $persistentStore.write(now.toString(), LOCK_TIME_KEY);

    // 2. 保存历史记录 (强制只保留最近 2 条)
    history.unshift({
        title: title,
        url: videoUrl,
        time: new Date().toLocaleString('zh-CN', { hour12: false }),
        timestamp: now 
    });

    if (history.length > MAX_HISTORY) {
        history = history.slice(0, MAX_HISTORY); // 保持 2 条
    }
    $persistentStore.write(JSON.stringify(history), HISTORY_KEY);

    // 3. 发送通知
    let vlcUrl = videoUrl.replace(/^http/, "vlc");
    $notification.post(
      title,
      "✅ 捕获成功 | 存2条 | 1分后清理",
      `链接若从历史消失，重进视频可再次抓取\n${videoUrl}`,
      { 
        "url": vlcUrl, 
        "open-url": vlcUrl, 
        "copy-output": videoUrl 
      }
    );
    log(`✅ 成功抓取新链接：${videoUrl}`);
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
