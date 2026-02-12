/*
Surge 万能抓视频脚本（长按通知选择播放器版）
兼容 Surge 5.16.x

功能：
- MP4 / M3U8 / JSON / 特殊路径抓取
- 历史仅保留 2 条（循环）
- 单条通知
- 点击通知：VLC 播放
- 长按通知：选择 VLC / nPlayer / Infuse / IINA / Safari
*/

let url = $request.url;
let body = $response.body || "";

// =====================
// 存储配置
// =====================
const HISTORY_KEY = "VideoCatch_History";
const MAX_HISTORY = 2;

// 读取历史
let history = JSON.parse($persistentStore.read(HISTORY_KEY) || "[]");

// =====================
// 工具函数
// =====================
function log(msg) {
  console.log("🎬 [VideoCatch] " + msg);
}

function alreadyCaptured(videoUrl) {
  return history.some(item => item.url === videoUrl);
}

function saveToHistory(title, videoUrl) {
  history.unshift({
    title,
    url: videoUrl,
    time: new Date().toLocaleString("zh-CN", { hour12: false })
  });

  if (history.length > MAX_HISTORY) {
    history = history.slice(0, MAX_HISTORY);
  }

  $persistentStore.write(JSON.stringify(history), HISTORY_KEY);
  log(`✅ 已存入历史（当前 ${history.length} 条）`);
}

// =====================
// 播放器 Action 菜单
// =====================
function buildActions(videoUrl) {
  return [
    { title: "▶ VLC",     url: "vlc://" + videoUrl },
    { title: "▶ nPlayer", url: "nplayer-" + videoUrl },
    { title: "▶ Infuse",  url: "infuse://x-callback-url/play?url=" + encodeURIComponent(videoUrl) },
    { title: "▶ IINA",    url: "iina://weblink?url=" + encodeURIComponent(videoUrl) },
    { title: "▶ Safari",  url: videoUrl }
  ];
}

// =====================
// 核心处理
// =====================
function processVideo(title, videoUrl) {
  if (alreadyCaptured(videoUrl)) {
    log("🚫 历史中已存在，跳过：\n" + videoUrl);
    return;
  }

  saveToHistory(title, videoUrl);

  $notification.post(
    title,
    "点击默认 VLC｜长按选择播放器",
    videoUrl,
    {
      url: "vlc://" + videoUrl,          // 直接点通知
      actions: buildActions(videoUrl)    // 长按菜单
    }
  );
}

// =====================
// 1. MP4
// =====================
if (url.includes(".mp4")) {
  log("发现 MP4：\n" + url);
  processVideo("🎥 MP4 捕获成功", url);
  $done({});
}

// =====================
// 2. M3U8
// =====================
else if (url.includes(".m3u8") || body.includes("#EXTM3U")) {
  log("发现 M3U8：\n" + url);
  processVideo("📺 M3U8 捕获成功", url);
  $done({});
}

// =====================
// 3. JSON / API
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
