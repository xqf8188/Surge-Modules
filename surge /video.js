/*
Surge 万能抓视频脚本（性能优化 + 复制跳转增强版）
功能：捕获视频、去重通知、过滤切片、点击跳转、长按复制
*/

let url = $request.url;
let method = $request.method;
// 只有在响应存在时才读取 body，并增加内容类型判断
let body = (typeof $response !== 'undefined' && $response.body) ? $response.body : "";
let contentType = (typeof $response !== 'undefined' && $response.headers) ? ($response.headers['Content-Type'] || $response.headers['content-type'] || "") : "";

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
  }
}

function alreadyNotified(u) {
  return notified.includes(u);
}

function log(msg) {
  console.log("🎬 [VideoCatch] " + msg);
}

// =====================
// VLC 跳转及保存逻辑 (增强版)
// =====================
function processVideo(title, videoUrl) {
  // --- 优化项：M3U8 切片过滤 ---
  // 过滤掉 .ts 片段以及常见的 m3u8 子索引（如 index_0.m3u8）
  if (videoUrl.includes(".ts") || videoUrl.includes("seg-") || videoUrl.match(/index_\d+\.m3u8/)) {
    return;
  }

  if (alreadyNotified(videoUrl)) return;

  saveToHistory(title, videoUrl);

  // 跳转协议保持原样
  let vlcUrl = "vlc://" + videoUrl;

  // --- 增强项：点击跳转 + 长按复制 ---
  $notification.post(
    title,
    "点击跳转 VLC | 长按通知可复制链接",
    videoUrl,
    { 
      "url": vlcUrl,            // 点击跳转动作
      "open-url": vlcUrl,       // 兼容性跳转字段
      "copy-output": videoUrl   // 长按显示的复制选项
    }
  );
  log(`✅ 捕获成功：${videoUrl}`);
}

// =====================
// 性能优化：静态资源预排除
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
// 2. 捕获 M3U8 (优化过滤)
// =====================
else if (url.includes(".m3u8") || body.includes("#EXTM3U")) {
  // 排除掉明显的切片 URL 模式后再通知
  if (!url.match(/(_\d+\.m3u8|\.ts)/)) {
     processVideo("📺 M3U8 捕获成功", url);
  }
}

// =====================
// 3. JSON 视频链接 (性能优化：限定类型与长度)
// =====================
else if (contentType.includes("application/json") || contentType.includes("text/plain") || contentType.includes("javascript")) {
  try {
    // 只有 Body 长度在合理范围（<500KB）才解析，避免大文件卡顿
    if (body && body.length < 512000) {
      // 这里的正则直接扫描，不进行 JSON.parse 以提高容错和速度
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
