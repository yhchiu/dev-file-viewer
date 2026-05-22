import { copyExtensionSettingsUrl, isFileUrlAccessAllowed, openExtensionSettings } from '../core/browser/fileUrlAccess.js';

const SNAPSHOT_PREFIX = 'sourceSnapshot:';

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

async function detectHtmlSourceInTab(tabId) {
  if (typeof tabId !== 'number') return null;

  try {
    const response = await chrome.tabs.sendMessage(tabId, { type: 'DETECT_HTML_SOURCE_DOCUMENT' });
    return response?.ok ? response : null;
  } catch {
    return null;
  }
}

async function openHtmlSourceSnapshot(snapshot) {
  const snapshotId = createSnapshotId();
  await chrome.storage.session.set({
    [`${SNAPSHOT_PREFIX}${snapshotId}`]: {
      url: snapshot.url || '',
      title: snapshot.title || '',
      mimeType: snapshot.mimeType || 'text/html',
      format: 'source-code',
      language: 'html',
      text: snapshot.text || '',
      createdAt: Date.now()
    }
  });
  await chrome.tabs.create({ url: viewerSnapshotUrl(snapshotId) });
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
}

async function refreshFileUrlStatus() {
  const card = document.querySelector('#file-url-card');
  const status = document.querySelector('#file-url-status');
  const isAllowed = await isFileUrlAccessAllowed();

  card.dataset.state = isAllowed ? 'enabled' : 'disabled';
  status.textContent = isAllowed
    ? 'Enabled. file:// Markdown and source links can open automatically.'
    : 'Not enabled. Use Open File/Open Folder, or enable this for automatic file:// links.';
}

document.querySelector('#open-current').addEventListener('click', async () => {
  const tab = await getActiveTab();
  const detected = await detectHtmlSourceInTab(tab?.id);

  if (detected?.isHtmlSource) {
    await openHtmlSourceSnapshot(detected);
  } else {
    await chrome.tabs.create({ url: viewerUrl(tab?.url || '') });
  }

  window.close();
});

document.querySelector('#open-viewer').addEventListener('click', async () => {
  await chrome.tabs.create({ url: viewerUrl() });
  window.close();
});

document.querySelector('#open-settings').addEventListener('click', async () => {
  await openExtensionSettings();
  window.close();
});

document.querySelector('#copy-settings-link').addEventListener('click', async () => {
  const status = document.querySelector('#file-url-status');
  try {
    const url = await copyExtensionSettingsUrl();
    status.textContent = `Copied: ${url}`;
  } catch (error) {
    status.textContent = error?.message || String(error);
  }
});

refreshFileUrlStatus().catch(error => {
  document.querySelector('#file-url-status').textContent = error?.message || String(error);
});
