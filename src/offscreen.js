import { decodeImageData } from './qr.js';

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
const MAX_IMAGE_PIXELS = 40 * 1000 * 1000;

async function decodeSource(source) {
  let response;
  try {
    response = await fetch(source, { credentials: 'include' });
  } catch {
    throw new Error('无法读取图片。图片可能已失效、需要登录、受跨域或网络限制。');
  }
  if (!response.ok) throw new Error('无法读取图片（HTTP ' + response.status + '）。图片可能需要登录或已失效。');
  const length = Number(response.headers.get('content-length'));
  if (length > MAX_IMAGE_BYTES) throw new Error('图片超过 20 MB，无法读取。');
  const blob = await response.blob();
  if (blob.size > MAX_IMAGE_BYTES) throw new Error('图片超过 20 MB，无法读取。');
  let bitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    throw new Error('无法解码图片文件，格式可能不受支持或文件已损坏。');
  }
  try {
    if (!bitmap.width || !bitmap.height || bitmap.width * bitmap.height > MAX_IMAGE_PIXELS) {
      throw new Error('图片尺寸过大，无法识别（上限为 4000 万像素）。');
    }
    const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('无法创建图片读取环境。');
    context.drawImage(bitmap, 0, 0);
    const text = decodeImageData(context.getImageData(0, 0, bitmap.width, bitmap.height));
    if (text === null) return { ok: false, error: '图片中未找到二维码，请尝试更清晰的图片。' };
    if (typeof text !== 'string') throw new Error('二维码识别返回了无效结果。');
    return { ok: true, text };
  } finally {
    bitmap.close();
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.target !== 'qr-offscreen' || message.type !== 'decode-image') return;
  decodeSource(message.source)
    .then(sendResponse)
    .catch(error => sendResponse({ ok: false, error: error?.message || '识别图片失败，请重试。' }));
  return true;
});
