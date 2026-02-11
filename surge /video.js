/*
Surge 万能抓视频脚本（重复抓取 + 性能优化版）
功能：允许重复捕获同一视频、去重通知关闭、长按复制、跳转 VLC
*/

let url = $request.url;
let method = $request.method;
let body = (typeof $response !== 'undefined' && $response.body) ? $response.body : "";
let contentType = (typeof $response !== 'undefined' && $response.headers) ? ($response.headers['Content-Type'] || $response.headers['content-type'] || "") : "";

// =====================
// 持久化储存配置
// =====================
const HISTORY_KEY = "VideoCatch_History";
const MAX_HISTORY = 100;

let history = JSON.parse($persistentStore.read(HISTORY_KEY) || "[]");

// 保存并更新历史记录
function saveToHistory(title, videoUrl) {
  let nowTime = new Date().toLocaleString('zh-CN', { hour12: false });
  
  // 查找是否已存在
  let index = history.findIndex(item => item.url === videoUrl);
  
  if (index !== -1) {
    // 如果存在，删除旧的，准备把新的置顶
    history.splice(index, 1);
  }
  
  let newItem = {
    title: title,
    url: videoUrl,
    time: nowTime
  };
  
  history.unshift(newItem); // 新记录/更新的记录排在最前面
  
  if (history.length > MAX_HISTORY) {
    history = history.slice(0, MAX_HISTORY);
  }
  
  $persistentStore.write(JSON.stringify(history), HISTORY_KEY);
}

function log(msg) {
  console.log("🎬 [VideoCatch] " + msg);
}

// =====================
// VLC 跳转及保存逻辑
// =====================
function processVideo(title, videoUrl) {
  // 仍然保留对分片(TS)的过滤，否则刷屏太严重
  if (videoUrl.includes(".ts") || videoUrl.includes("seg-") || videoUrl.match(/index_\d+\.m3u8/)) {
    return;
  }

  // --- 关键修改：删除了 alreadyNotified 判断，允许重复抓取 ---

  saveToHistory(title, videoUrl);

  let vlcUrl = "vlc://" + videoUrl;
  $notification.post(
    title,
    "点击跳转 VLC | 长按复制链接",
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
// 性能优化：排除无关请求
// =====================
if (url.match(/\.(png|jpg|jpeg|gif|webp|zip|gz|woff|ttf|css|js|svg)/i)) {
  $done({});
}

// =====================
// 1. 捕获 MP4
// =====================
if (url.includes(".mp4")) {
  processVideo("🎥 MP4 捕获成功", url);
}

// =====================
// 2. 捕获 M3U8
// =====================
else if (url.includes(".m3u8") || body.includes("#EXTM3U")) {
  // 排除掉明显的切片 URL 模式
  if (!url.match(/(_\d+\.m3u8|\.ts)/)) {
     processVideo("📺 M3U8 捕获成功", url);
  }
}

// =====================
// 3. JSON/Text 视频链接扫描
// =====================
else if (contentType.includes("application/json") || contentType.includes("text/plain") || contentType.includes("javascript")) {
  try {
    if (body && body.length < 512000) {
      let found = body.match(/https?:\/\/[^"'\s]+\.(mp4|m3u8)(?:[\w\.\-\?&=\/!%]*)/g);
      if (found) {
        found = [...new Set(found)];
        found.forEach(v => {
          processVideo("📡 API 视频捕获", v);
        });
      }
    }
  } catch (e) {}
}

// =====================
// 4. 特殊路径
// =====================
if (
  url.includes("mfpt8g.com") || url.includes("vdmk") || url.includes("dlmk") || url.includes("decrypt")
) {
  processVideo("🔐 加密视频捕获", url);
}

$done({});
