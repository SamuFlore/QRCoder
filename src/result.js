const title = document.getElementById('result-title');
const badge = document.getElementById('badge');
const description = document.getElementById('description');
const output = document.getElementById('result');
const copy = document.getElementById('copy');
const open = document.getElementById('open');
const feedback = document.getElementById('feedback');

function showError(message) {
  title.textContent = '识别未完成';
  badge.textContent = '未识别';
  badge.classList.add('error');
  badge.hidden = false;
  description.textContent = message;
}

async function displayResult() {
  const id = location.hash.slice(1);
  if (!/^[0-9a-f-]{36}$/i.test(id)) return showError('找不到识别结果，请重新识别图片。');
  const key = 'qr-result:' + id;
  let result;
  try {
    const stored = await chrome.storage.session.get(key);
    result = stored[key];
    await chrome.storage.session.remove(key);
  } catch {
    return showError('无法读取识别结果，请重新识别图片。');
  }
  if (!result) return showError('识别结果已失效，请重新识别图片。');
  if (!result.ok || typeof result.text !== 'string') return showError(result.error || '识别失败，请重试。');
  const text = result.text;
  title.textContent = '识别成功';
  badge.textContent = '已识别';
  badge.hidden = false;
  description.textContent = '已识别以下内容，可选择复制。';
  output.textContent = text;
  output.hidden = false;
  copy.hidden = false;
  copy.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(text);
      feedback.textContent = '已复制到剪贴板。';
    } catch {
      feedback.textContent = '复制失败，请手动选择并复制内容。';
    }
  });
  try {
    const url = new URL(text);
    if (/^https?:\/\/\S+$/i.test(text) && (url.protocol === 'http:' || url.protocol === 'https:')) {
      open.hidden = false;
      open.addEventListener('click', () => chrome.tabs.create({ url: url.href }));
    }
  } catch { /* 内容不是链接。 */ }
}

void displayResult();
