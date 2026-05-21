export function getExtensionSettingsUrl() {
  return `chrome://extensions/?id=${chrome.runtime.id}`;
}

export async function isFileUrlAccessAllowed() {
  if (!globalThis.chrome?.extension?.isAllowedFileSchemeAccess) return false;

  return new Promise(resolve => {
    chrome.extension.isAllowedFileSchemeAccess(isAllowed => resolve(Boolean(isAllowed)));
  });
}

export async function openExtensionSettings() {
  const url = getExtensionSettingsUrl();

  if (globalThis.chrome?.tabs?.create) {
    await chrome.tabs.create({ url });
    return;
  }

  window.open(url, '_blank', 'noopener,noreferrer');
}

export async function copyExtensionSettingsUrl() {
  const url = getExtensionSettingsUrl();
  if (!globalThis.navigator?.clipboard?.writeText) {
    throw new Error(`Clipboard API is unavailable. Open ${url} manually.`);
  }

  await navigator.clipboard.writeText(url);
  return url;
}
