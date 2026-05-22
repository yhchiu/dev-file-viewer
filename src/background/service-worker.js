const DOCUMENT_EXTENSIONS = [
    '.md', '.mkd', '.mdx', '.markdown',
    '.diff', '.patch',
    '.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx',
    '.html', '.htm', '.css', '.json', '.jsonc', '.yaml', '.yml', '.toml', '.ini',
    '.xml', '.svg', '.sh', '.bash', '.zsh', '.ps1', '.py', '.go', '.java',
    '.c', '.h', '.cpp', '.cc', '.cxx', '.hpp', '.hh', '.hxx', '.rs', '.cs',
    '.php', '.rb', '.sql', '.swift', '.kt', '.kts', '.scala', '.dart', '.lua',
    '.r', '.pl', '.pm', '.ex', '.exs', '.erl', '.hrl', '.clj', '.cljs',
    '.groovy', '.gradle', '.vue', '.svelte', '.dockerfile', '.makefile', '.cmake'
  ];
const SNAPSHOT_PREFIX = 'sourceSnapshot:';
const SNAPSHOT_TTL_MS = 30 * 60 * 1000;

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

function viewerSnapshotUrl(snapshotId) {
  return chrome.runtime.getURL(`viewer/index.html?snapshot=${encodeURIComponent(snapshotId)}`);
}

function createSnapshotId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

async function cleanupExpiredSnapshots(now = Date.now()) {
  const all = await chrome.storage.session.get(null);
  const expiredKeys = Object.entries(all)
    .filter(([key, value]) => key.startsWith(SNAPSHOT_PREFIX) && now - Number(value?.createdAt || 0) > SNAPSHOT_TTL_MS)
    .map(([key]) => key);

  if (expiredKeys.length) await chrome.storage.session.remove(expiredKeys);
}

async function openViewerForSnapshot(message, sender) {
  const tabId = sender.tab?.id;
  if (typeof tabId !== 'number') throw new Error('Missing sender tab.');
  if (!isSupportedDocumentUrl(message.url || '')) throw new Error('Unsupported developer file URL.');

  await cleanupExpiredSnapshots();

  const snapshotId = createSnapshotId();
  await chrome.storage.session.set({
    [`${SNAPSHOT_PREFIX}${snapshotId}`]: {
      url: message.url || '',
      title: message.title || '',
      mimeType: message.mimeType || '',
      format: message.format || '',
      language: message.language || '',
      text: message.text || '',
      createdAt: Date.now()
    }
  });

  await chrome.tabs.update(tabId, { url: viewerSnapshotUrl(snapshotId) });
  return { ok: true, snapshotId };
}

chrome.runtime.onInstalled.addListener(details => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: chrome.runtime.getURL('onboarding/index.html') });
  }

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
  if (message?.type === 'OPEN_VIEWER_FOR_SNAPSHOT') {
    openViewerForSnapshot(message, sender)
      .then(sendResponse)
      .catch(error => sendResponse({ ok: false, error: error?.message || String(error) }));
    return true;
  }

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
