import { copyExtensionSettingsUrl, isFileUrlAccessAllowed, openExtensionSettings } from '../core/browser/fileUrlAccess.js';

function viewerUrl() {
  return chrome.runtime.getURL('viewer/index.html');
}

async function refreshFileUrlStatus() {
  const card = document.querySelector('#file-url-card');
  const status = document.querySelector('#file-url-status');
  const isAllowed = await isFileUrlAccessAllowed();

  card.dataset.state = isAllowed ? 'enabled' : 'disabled';
  status.textContent = isAllowed
    ? 'Enabled. Dev File Viewer can automatically preview supported file:// Markdown URLs.'
    : 'Not enabled. This is optional; Open File and Open Folder work without this setting.';
}

document.querySelector('#open-viewer').addEventListener('click', async () => {
  await chrome.tabs.create({ url: viewerUrl() });
});

document.querySelector('#open-settings').addEventListener('click', () => openExtensionSettings());

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
