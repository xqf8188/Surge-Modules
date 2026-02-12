/*
Surge 万能抓视频脚本（VLC 跳转 + 历史循环版）
兼容 Surge 5.16.x
规则：
- 只以 history 去重
- history 只保留 2 条
- 被挤出历史的链接 → 可再次抓取
*/

let url = $request.url;
let body = $response.body || "";

// =====================
// 持久化储存配置
// =====================
const HISTORY_KEY = "VideoCatch_History";
const MAX_HISTORY = 2; // ✅ 只保留 2 条

// 读取历史
let history = JSON.parse($persistentStore.read(HISTORY_KEY) || "[]");

// =====================
// 工具函数
// =====================
function log(msg) {
  console.log("🎬 [VideoCatch] " + msg);
}

// 判断是否已在历史中
function alreadyCaptured(videoUrl) {
  return history.some(item => item.url === videoUrl);
}

// 保存历史（循环 2 条）
function saveToHistory(title, videoUrl) {
  let newItem = {
    title: title,
    url: videoUrl,
    time: new Date().toLocaleString('zh-CN', { hour12: false })
  };

  history.unshift(newItem);

  if (history.length > MAX_HISTORY) {
    history = history.slice(0, MAX_HISTORY);
  }

  $persistentStore.write(JSON.stringify(history), HISTORY_KEY);
  log(`✅ 已存入历史（当前 ${history.length} 条）`);
}

// =====================
// VLC 跳转 + 保存
// =====================
function processVideo(title, videoUrl) {
  if (alreadyCaptured(videoUrl)) {
    log("🚫 历史中已存在，跳过：\n" + videoUrl);
    return;
  }

  saveToHistory(title, videoUrl);

  let vlcUrl = "vlc://" + videoUrl;
  $notification.post(
    title,
    "点击跳转 VLC｜历史仅保留 2 条",
    videoUrl,
    { url: vlcUrl }
  );
}

// =====================
// 1. 捕获 MP4
// =====================
if (url.includes(".mp4")) {
  log("发现 MP4：\n" + url);
  processVideo("🎥 MP4 捕获成功", url);
  $done({});
}

// =====================
// 2. 捕获 M3U8
// =====================
else if (url.includes(".m3u8") || body.includes("#EXTM3U")) {
  log("发现 M3U8：\n" + url);
  processVideo("📺 M3U8 捕获成功", url);
  $done({});
}

// =====================
// 3. JSON / API 中提取视频
// =====================
else {
  try {
    let j = JSON.parse(body);
    let found = JSON.stringify(j).match(/https?:\/\/[^"]+\.(mp4|m3u8)/g);
    if (found) {
      [...new Set(found)].forEach(v => {
        log("JSON 发现视频：\n" + v);
        processVideo("📡 API 视频捕获", v);
      });
    }
  } catch (e) {}
}

// =====================
// 4. 特殊 / 加密路径
// =====================
if (
  url.includes("mfpt8g.com") ||
  url.includes("vdmk") ||
  url.includes("dlmk") ||
  url.includes("decrypt")
) {
  log("加密路径捕获：\n" + url);
  processVideo("🔐 加密视频捕获", url);
}

$done({});
