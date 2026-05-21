import { copyExtensionSettingsUrl, isFileUrlAccessAllowed, openExtensionSettings } from '../core/browser/fileUrlAccess.js';

function viewerUrl(url = '') {
  const suffix = url ? `?url=${encodeURIComponent(url)}` : '';
  return chrome.runtime.getURL(`viewer/index.html${suffix}`);
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
  await chrome.tabs.create({ url: viewerUrl(tab?.url || '') });
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
