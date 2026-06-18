import { isFileUrlAccessAllowed } from '../core/browser/fileUrlAccess.js';
import { localizeDocument, t } from '../core/i18n/i18n.js';
import { syncChromeTheme } from '../core/ui/chromeTheme.js';
import { looksLikeHtmlSource } from '../core/format/htmlSourceDetection.js';
import { FORMAT_IDS, detectFormat } from '../core/format/fileTypes.js';

localizeDocument();
syncChromeTheme();

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

// Runs in the active tab's page context (injected via activeTab + scripting),
// so it must be fully self-contained — no imports or outer-scope references.
// Mirrors getDocumentText()/isPlainTextDocument() in the content script.
function captureDocumentSnapshot() {
  const body = document.body;
  const onlyPre = !!(body && body.children.length === 1
    && body.firstElementChild && body.firstElementChild.tagName === 'PRE');
  const source = onlyPre ? body.firstElementChild : body;
  const text = (source && source.innerText)
    || (document.documentElement && document.documentElement.innerText)
    || '';
  const mimeType = document.contentType || '';
  const isPlainText = onlyPre
    || /^(text\/plain|text\/markdown|application\/octet-stream)/i.test(mimeType);
  return { text, mimeType, title: document.title || '', url: location.href, isPlainText };
}

// Capture the active tab's content on demand using activeTab — no broad host
// permission required. Returns null for restricted tabs (chrome://, Web Store).
async function captureActiveTabSnapshot(tabId) {
  if (typeof tabId !== 'number') return null;

  try {
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId },
      func: captureDocumentSnapshot
    });
    return injection?.result || null;
  } catch {
    return null;
  }
}

async function openSnapshotDoc(snapshot, { format = '', language = '' } = {}) {
  const snapshotId = createSnapshotId();
  await chrome.storage.session.set({
    [`${SNAPSHOT_PREFIX}${snapshotId}`]: {
      url: snapshot.url || '',
      title: snapshot.title || '',
      mimeType: snapshot.mimeType || '',
      format,
      language,
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
    ? t('popupFileUrlEnabled')
    : t('popupFileUrlDisabled');
}

document.querySelector('#open-current').addEventListener('click', async () => {
  const tab = await getActiveTab();
  const snapshot = await captureActiveTabSnapshot(tab?.id);

  if (snapshot?.text) {
    // HTML source shown as text (e.g. viewing a page's raw source).
    if (looksLikeHtmlSource(snapshot.text, { mimeType: snapshot.mimeType, url: snapshot.url })) {
      await openSnapshotDoc(snapshot, { format: FORMAT_IDS.SOURCE_CODE, language: 'html' });
      window.close();
      return;
    }
    // Plain-text developer files (raw .md/.js/...). Using the captured snapshot
    // avoids a credential-less re-fetch and needs no broad host permission.
    if (snapshot.isPlainText) {
      await openSnapshotDoc(snapshot, {
        format: detectFormat({ url: snapshot.url, mimeType: snapshot.mimeType })
      });
      window.close();
      return;
    }
  }

  // Rendered page (or a tab we cannot read): let the viewer fetch the URL.
  // For remote pages this needs the opt-in http(s) permission (Settings).
  await chrome.tabs.create({ url: viewerUrl(tab?.url || '') });
  window.close();
});

document.querySelector('#open-viewer').addEventListener('click', async () => {
  await chrome.tabs.create({ url: viewerUrl() });
  window.close();
});

document.querySelector('#open-app-settings').addEventListener('click', async () => {
  await chrome.runtime.openOptionsPage();
  window.close();
});

refreshFileUrlStatus().catch(error => {
  document.querySelector('#file-url-status').textContent = error?.message || String(error);
});
