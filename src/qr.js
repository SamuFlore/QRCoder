import QRCode from 'qrcode';
import jsQR from 'jsqr';

export async function generateDataUrl(text, { size = 256, margin = 4, dark = '#000000', light = '#ffffff' } = {}) {
  if (typeof text !== 'string' || text.length === 0) {
    throw new Error('请输入二维码内容');
  }
  if (!Number.isInteger(size) || size < 1 || !Number.isInteger(margin) || margin < 0) {
    throw new Error('二维码尺寸和边距必须是有效的整数');
  }
  return QRCode.toDataURL(text, {
    type: 'image/png',
    width: size,
    margin,
    color: { dark, light },
    errorCorrectionLevel: 'M',
  });
}

export function decodeImageData(imageData) {
  if (!imageData || !Number.isInteger(imageData.width) || !Number.isInteger(imageData.height) ||
      imageData.width <= 0 || imageData.height <= 0 ||
      !imageData.data || imageData.data.length !== imageData.width * imageData.height * 4) {
    return null;
  }
  return jsQR(imageData.data, imageData.width, imageData.height)?.data ?? null;
}
