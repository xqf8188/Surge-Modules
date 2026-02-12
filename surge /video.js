/*
Surge 万能抓视频脚本（优化去重版）
功能：捕获视频、跳转 VLC、自动保存历史
逻辑：只要历史记录里不存在该链接，即触发通知并保存
*/

let url = $request.url;
let body = $response.body || "";

// =====================
// 持久化储存配置
// =====================
const HISTORY_KEY = "VideoCatch_History";
const MAX_HISTORY = 100; // 最大储存 100 条

// 读取数据
let history = JSON.parse($persistentStore.read(HISTORY_KEY) || "[]");

// 保存历史记录函数
function saveToHistory(title, videoUrl) {
  let exists = history.find(item => item.url === videoUrl);
  if (!exists) {
    let newItem = {
      title: title,
      url: videoUrl,
      time: new Date().toLocaleString('zh-CN', { hour12: false })
    };
    history.unshift(newItem); // 新记录排在最前面
    
    // 限制长度
    if (history.length > MAX_HISTORY) {
      history = history.slice(0, MAX_HISTORY);
    }
    
    $persistentStore.write(JSON.stringify(history), HISTORY_KEY);
    log(`✅ 已存入历史 (当前共 ${history.length} 条)`);
    return true; // 表示是新抓取的
  }
  return false; // 表示已存在
}

function log(msg) {
  console.log("🎬 [VideoCatch] " + msg);
}

// =====================
// VLC 跳转及保存逻辑
// =====================
function processVideo(title, videoUrl) {
  // 尝试保存，如果返回 true 说明历史记录里没有，执行通知
  if (saveToHistory(title, videoUrl)) {
    let vlcUrl = "vlc://" + videoUrl;
    $notification.post(
      title,
      "点击跳转 VLC | 链接已自动保存",
      videoUrl,
      { url: vlcUrl }
    );
  } else {
    log("🚫 历史记录中已存在该链接，跳过通知");
  }
}

// =====================
// 1. 捕获 MP4
// =====================
if (url.includes(".mp4")) {
  log("发现 MP4：\n" + url);
  processVideo("🎥 MP4 捕获成功", url);
}

// =====================
// 2. 捕获 M3U8
// =====================
else if (url.includes(".m3u8") || body.includes("#EXTM3U")) {
  log("发现 M3U8：\n" + url);
  processVideo("📺 M3U8 捕获成功", url);
}

// =====================
// 3. JSON 视频链接
// =====================
else {
  try {
    let j = JSON.parse(body);
    let found = JSON.stringify(j).match(/https?:\/\/[^"]+\.(mp4|m3u8)/g);
    if (found) {
      found = [...new Set(found)];
      found.forEach(v => {
        log("JSON 发现视频： " + v);
        processVideo("📡 API 视频捕获", v);
      });
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
  log("加密路径捕获：\n" + url);
  processVideo("🔐 加密视频捕获", url);
}

$done({});
