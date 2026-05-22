import { copyExtensionSettingsUrl, isFileUrlAccessAllowed, openExtensionSettings } from '../core/browser/fileUrlAccess.js';
import { localizeDocument, t } from '../core/i18n/i18n.js';

localizeDocument();

function viewerUrl() {
  return chrome.runtime.getURL('viewer/index.html');
}

async function refreshFileUrlStatus() {
  const card = document.querySelector('#file-url-card');
  const status = document.querySelector('#file-url-status');
  const isAllowed = await isFileUrlAccessAllowed();

  card.dataset.state = isAllowed ? 'enabled' : 'disabled';
  status.textContent = isAllowed
    ? t('onboardingFileUrlEnabled')
    : t('onboardingFileUrlDisabled');
}

document.querySelector('#open-viewer').addEventListener('click', async () => {
  await chrome.tabs.create({ url: viewerUrl() });
});

document.querySelector('#open-settings').addEventListener('click', () => openExtensionSettings());

document.querySelector('#copy-settings-link').addEventListener('click', async () => {
  const status = document.querySelector('#file-url-status');
  try {
    const url = await copyExtensionSettingsUrl();
    status.textContent = t('statusCopied', [url]);
  } catch (error) {
    status.textContent = error?.message || String(error);
  }
});

refreshFileUrlStatus().catch(error => {
  document.querySelector('#file-url-status').textContent = error?.message || String(error);
});
