function viewerUrl(url = '') {
  const suffix = url ? `?url=${encodeURIComponent(url)}` : '';
  return chrome.runtime.getURL(`viewer/index.html${suffix}`);
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab;
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
