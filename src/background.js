const MENU_ID = 'decode-image';
const OFFSCREEN_PATH = 'offscreen.html';
let creatingOffscreen;

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: MENU_ID, title: '识别图片中的二维码', contexts: ['image'] });
});

async function ensureOffscreen() {
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [chrome.runtime.getURL(OFFSCREEN_PATH)]
  });
  if (contexts.length) return;
  if (!creatingOffscreen) {
    creatingOffscreen = chrome.offscreen.createDocument({
      url: OFFSCREEN_PATH,
      reasons: ['BLOBS'],
      justification: '在本地读取图片并识别二维码'
    }).finally(() => { creatingOffscreen = undefined; });
  }
  await creatingOffscreen;
}

async function readPageBlob(tabId, frameId, url) {
  if (tabId == null) throw new Error('无法访问图片所在的页面。');
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId, frameIds: [frameId ?? 0] },
      func: async (source) => {
        try {
          const response = await fetch(source);
          if (!response.ok) throw new Error();
          const blob = await response.blob();
          if (blob.size > 20 * 1024 * 1024) return { error: '图片超过 20 MB，无法读取。' };
          const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(reader.error);
            reader.readAsDataURL(blob);
          });
          return { dataUrl };
        } catch {
          return { error: '无法读取页面中的 blob 图片，图片可能已失效或受到页面限制。' };
        }
      },
      args: [url]
    });
    const result = results[0]?.result;
    if (result?.error) throw new Error(result.error);
    if (typeof result?.dataUrl !== 'string') throw new Error('无法读取页面中的 blob 图片。');
    return result.dataUrl;
  } catch (error) {
    if (error?.message?.startsWith('无法读取') || error?.message?.startsWith('图片超过')) throw error;
    throw new Error('无法访问图片所在页面或框架；浏览器内部页面及受限制页面不支持读取 blob 图片。');
  }
}

async function showResult(result) {
  const id = crypto.randomUUID();
  const key = 'qr-result:' + id;
  await chrome.storage.session.set({ [key]: result });
  try {
    await chrome.windows.create({
      url: chrome.runtime.getURL('result.html') + '#' + id,
      type: 'popup', width: 560, height: 620
    });
  } catch (error) {
    await chrome.storage.session.remove(key);
    throw error;
  }
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId !== MENU_ID) return;
  void (async () => {
    let result;
    try {
      let source = info.srcUrl;
      if (!source) throw new Error('无法获取图片地址。');
      if (source.startsWith('blob:')) source = await readPageBlob(tab?.id, info.frameId, source);
      if (!/^(data:|https?:)/i.test(source)) throw new Error('不支持此图片地址。请使用 data:、blob: 或 HTTP(S) 图片。');
      await ensureOffscreen();
      const response = await chrome.runtime.sendMessage({ target: 'qr-offscreen', type: 'decode-image', source });
      if (!response || typeof response.ok !== 'boolean') throw new Error('识别服务没有响应，请重试。');
      result = response;
    } catch (error) {
      result = { ok: false, error: error?.message || '图片识别失败，请重试。' };
    }
    try {
      await showResult(result);
    } catch (error) {
      console.error('无法打开二维码结果窗口', error);
    }
  })();
});
