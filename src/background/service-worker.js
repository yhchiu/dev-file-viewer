import { t } from '../core/i18n/i18n.js';
import { isSupportedViewerFile } from '../core/format/fileTypes.js';
import { affectsWebOrigins, syncWebAutoviewRegistration } from './webAutoview.js';

const SNAPSHOT_PREFIX = 'sourceSnapshot:';
const SNAPSHOT_TTL_MS = 30 * 60 * 1000;

function isSupportedDocumentUrl(url = '') {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:', 'file:'].includes(parsed.protocol)) return false;
    return isSupportedViewerFile(parsed.pathname);
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
    .filter(
      ([key, value]) =>
        key.startsWith(SNAPSHOT_PREFIX) && now - Number(value?.createdAt || 0) > SNAPSHOT_TTL_MS
    )
    .map(([key]) => key);

  if (expiredKeys.length) await chrome.storage.session.remove(expiredKeys);
}

async function openViewerForSnapshot(message, sender) {
  const tabId = sender.tab?.id;
  if (typeof tabId !== 'number') throw new Error('Missing sender tab.');
  if (!isSupportedDocumentUrl(message.url || ''))
    throw new Error('Unsupported developer file URL.');

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
    chrome.tabs.create({ url: chrome.runtime.getURL('settings/index.html#about') });
  }

  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'open-dev-file-viewer-page',
      title: t('ctxOpenPage'),
      contexts: ['page']
    });
    chrome.contextMenus.create({
      id: 'open-dev-file-viewer-link',
      title: t('ctxOpenLink'),
      contexts: ['link']
    });
  });

  syncWebAutoviewRegistration();
});

// Keep the opt-in http(s) autoview registration in sync across restarts and
// whenever the user grants or revokes the web host permission.
chrome.runtime.onStartup.addListener(() => {
  syncWebAutoviewRegistration();
});

chrome.permissions.onAdded.addListener(permissions => {
  if (affectsWebOrigins(permissions)) syncWebAutoviewRegistration();
});

chrome.permissions.onRemoved.addListener(permissions => {
  if (affectsWebOrigins(permissions)) syncWebAutoviewRegistration();
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
