/*
Surge 万能抓视频脚本（VLC 跳转 + 性能优化版）
功能：捕获视频、去重通知、过滤切片、降低系统开销
*/

const url = $request.url;
const method = $request.method;
// 性能优化：只有在响应存在时才读取 body
const body = (typeof $response !== 'undefined' && $response.body) ? $response.body : "";
const contentType = (typeof $response !== 'undefined' && $response.headers) ? ($response.headers['Content-Type'] || $response.headers['content-type'] || "") : "";

// =====================
// 持久化储存配置
// =====================
const HISTORY_KEY = "VideoCatch_History";
const NOTIFIED_KEY = "VideoCatch_Notified";
const MAX_HISTORY = 100;

let history = JSON.parse($persistentStore.read(HISTORY_KEY) || "[]");
let notified = JSON.parse($persistentStore.read(NOTIFIED_KEY) || "[]");

function saveToHistory(title, videoUrl) {
  if (!notified.includes(videoUrl)) {
    notified.push(videoUrl);
    if (notified.length > 200) notified.shift();
    $persistentStore.write(JSON.stringify(notified), NOTIFIED_KEY);
  }

  let exists = history.find(item => item.url === videoUrl);
  if (!exists) {
    let newItem = {
      title: title,
      url: videoUrl,
      time: new Date().toLocaleString('zh-CN', { hour12: false })
    };
    history.unshift(newItem);
    if (history.length > MAX_HISTORY) history = history.slice(0, MAX_HISTORY);
    $persistentStore.write(JSON.stringify(history), HISTORY_KEY);
    log(`✅ 已存入历史 (共 ${history.length} 条)`);
  }
}

function alreadyNotified(u) {
  return notified.includes(u);
}

function log(msg) {
  console.log("🎬 [VideoCatch] " + msg);
}

// =====================
// VLC 跳转逻辑 (保持原样)
// =====================
function processVideo(title, videoUrl) {
  // M3U8 误报过滤：如果链接包含 .ts 或常见的切片关键字，则忽略
  if (videoUrl.includes(".ts") || videoUrl.includes("seg-") || videoUrl.match(/\/(\d+)\.m3u8/)) {
    // 排除掉类似 index_0.m3u8 这种切片索引，只抓主文件
    return;
  }

  if (alreadyNotified(videoUrl)) return;

  saveToHistory(title, videoUrl);

  let vlcUrl = "vlc://" + videoUrl;
  $notification.post(
    title,
    "点击跳转 VLC | 链接已自动保存",
    videoUrl,
    { url: vlcUrl }
  );
}

// =====================
// 性能过滤逻辑 (优化项 1)
// =====================
// 如果是图片、字体、样式表等无关请求，直接结束
if (url.match(/\.(png|jpg|jpeg|gif|webp|zip|gz|woff|ttf|css|js)/i)) {
  $done({});
}

// =====================
// 1. 捕获 MP4
// =====================
if (url.includes(".mp4")) {
  processVideo("🎥 MP4 捕获成功", url);
}

// =====================
// 2. 捕获 M3U8 (优化项 2：增加切片指纹过滤)
// =====================
else if (url.includes(".m3u8") || body.includes("#EXTM3U")) {
  // 仅当 URL 不包含明显的切片特征时才通知
  if (!url.match(/(_\d+\.m3u8|\.ts)/)) {
     processVideo("📺 M3U8 捕获成功", url);
  }
}

// =====================
// 3. JSON 视频链接 (优化项 3：仅处理 JSON/Text 类型)
// =====================
else if (contentType.includes("application/json") || contentType.includes("text/plain") || contentType.includes("application/x-javascript")) {
  try {
    // 只有 Body 长度小于 500KB 才解析，防止解析超大 JSON 导致卡顿
    if (body.length > 0 && body.length < 512000) {
      let found = body.match(/https?:\/\/[^"']+\.(mp4|m3u8)/g);
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
// 4. 特殊加密路径
// =====================
if (
  url.includes("mfpt8g.com") ||
  url.includes("vdmk") ||
  url.includes("dlmk") ||
  url.includes("decrypt")
) {
  processVideo("🔐 加密视频捕获", url);
}

$done({});
