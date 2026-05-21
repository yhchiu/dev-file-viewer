const DOCUMENT_EXTENSIONS = ['.md', '.mkd', '.mdx', '.markdown'];

function isSupportedDocumentUrl(url = '') {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:', 'file:'].includes(parsed.protocol)) return false;
    return DOCUMENT_EXTENSIONS.some(ext => parsed.pathname.toLowerCase().endsWith(ext));
  } catch {
    return false;
  }
}

function viewerUrl(url = '') {
  const suffix = url ? `?url=${encodeURIComponent(url)}` : '';
  return chrome.runtime.getURL(`viewer/index.html${suffix}`);
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'open-dev-file-viewer-page',
      title: 'Open page with Dev File Viewer',
      contexts: ['page']
    });
    chrome.contextMenus.create({
      id: 'open-dev-file-viewer-link',
      title: 'Open link with Dev File Viewer',
      contexts: ['link']
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  const targetUrl = info.linkUrl || info.pageUrl || tab?.url || '';
  chrome.tabs.create({ url: viewerUrl(targetUrl) });
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === 'OPEN_VIEWER_FOR_TAB') {
    const targetUrl = message.url || sender.tab?.url || '';
    chrome.tabs.create({ url: viewerUrl(targetUrl) });
    sendResponse({ ok: true });
    return true;
  }

  if (message?.type === 'IS_SUPPORTED_DOCUMENT_URL') {
    sendResponse({ ok: true, supported: isSupportedDocumentUrl(message.url) });
    return true;
  }

  return false;
});
