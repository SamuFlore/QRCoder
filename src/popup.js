import { generateDataUrl } from './qr.js';

const elements = Object.fromEntries(
  ['page-url', 'preview', 'placeholder', 'status', 'dark', 'light', 'size', 'margin', 'dark-value', 'light-value', 'size-value', 'margin-value', 'download']
    .map((id) => [id, document.getElementById(id)])
);
let pageUrl = null;
let currentDataUrl = null;
let generation = 0;

function setStatus(message, isError = false) {
  elements.status.textContent = message;
  elements.status.classList.toggle('error', isError);
}

function relativeLuminance(hex) {
  const channels = [1, 3, 5].map((offset) => {
    const value = parseInt(hex.slice(offset, offset + 2), 16) / 255;
    return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function styleWarning({ dark, light, margin }) {
  const foreground = relativeLuminance(dark);
  const background = relativeLuminance(light);
  const contrast = (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
  const issues = [];
  if (foreground >= background) issues.push('前景色不比背景色深');
  if (contrast < 4.5) issues.push('颜色对比度不足');
  if (margin < 4) issues.push('留白不足 4 格');
  return issues.length ? issues.join('、') + '，可能无法识别。' : '';
}

function updateValues() {
  elements['dark-value'].textContent = elements.dark.value.toUpperCase();
  elements['light-value'].textContent = elements.light.value.toUpperCase();
  elements['size-value'].textContent = elements.size.value + ' px';
  elements['margin-value'].textContent = elements.margin.value + ' 格';
}

async function renderQr() {
  updateValues();
  if (!pageUrl) return;
  const request = ++generation;
  currentDataUrl = null;
  elements.download.disabled = true;
  setStatus('正在生成二维码…');
  const options = {
    size: Number(elements.size.value),
    margin: Number(elements.margin.value),
    dark: elements.dark.value,
    light: elements.light.value
  };
  try {
    const dataUrl = await generateDataUrl(pageUrl, options);
    if (request !== generation) return;
    if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/png')) throw new Error('无效的图片数据');
    currentDataUrl = dataUrl;
    elements.preview.src = dataUrl;
    elements.preview.hidden = false;
    elements.placeholder.hidden = true;
    elements.download.disabled = false;
    const warning = styleWarning(options);
    setStatus(warning || '二维码已生成', Boolean(warning));
  } catch (error) {
    if (request !== generation) return;
    elements.preview.hidden = true;
    elements.placeholder.hidden = false;
    elements.placeholder.querySelector('span').textContent = '暂时无法生成二维码';
    setStatus('生成失败，请调整参数后重试。', true);
  }
}

for (const id of ['dark', 'light', 'size', 'margin']) {
  elements[id].addEventListener('input', renderQr);
}

elements.download.addEventListener('click', () => {
  if (!currentDataUrl) return;
  const link = document.createElement('a');
  link.href = currentDataUrl;
  link.download = '网页二维码.png';
  link.click();
});

async function initialize() {
  updateValues();
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const url = new URL(tab?.url || '');
    if (!['http:', 'https:'].includes(url.protocol)) throw new Error('unsupported');
    pageUrl = url.href;
    elements['page-url'].textContent = pageUrl;
    elements['page-url'].title = pageUrl;
    await renderQr();
  } catch (error) {
    elements['page-url'].textContent = '无法获取可用的网页地址';
    elements['page-url'].title = '';
    elements.placeholder.querySelector('span').textContent = '此页面暂不支持生成';
    setStatus('请打开 HTTP 或 HTTPS 网页后重试。', true);
  }
}

initialize();
