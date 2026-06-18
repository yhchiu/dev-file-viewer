import { matchedAutoOpenKey } from '../core/format/fileTypes.js';

(() => {
  const REDIRECT_FLAG = 'devFileViewerRedirecting';
  const AUTO_OPEN_KEY = 'devFileViewer:autoOpen';

  function isPlainTextDocument() {
    const contentType = document.contentType || '';
    if (/^(text\/plain|text\/markdown|application\/octet-stream)/i.test(contentType)) return true;

    // Chrome often displays raw text documents as a body with one PRE element.
    const body = document.body;
    return Boolean(body && body.children.length === 1 && body.firstElementChild?.tagName === 'PRE');
  }

  async function isAutoOpenEnabledFor(key) {
    try {
      const stored = await chrome.storage.local.get(AUTO_OPEN_KEY);
      const config = stored[AUTO_OPEN_KEY] || {};
      if (config.enabled === false) return false;
      return !(Array.isArray(config.disabled) && config.disabled.includes(key));
    } catch {
      // Default to enabled if storage is unavailable.
      return true;
    }
  }

  async function shouldOpenInViewer() {
    const key = matchedAutoOpenKey(location.href);
    if (!key) return false;
    if (sessionStorage.getItem(REDIRECT_FLAG) === '1') return false;
    if (!['http:', 'https:', 'file:'].includes(location.protocol)) return false;
    if (!isPlainTextDocument()) return false;
    return isAutoOpenEnabledFor(key);
  }

  function getDocumentText() {
    const pre =
      document.body?.children?.length === 1 && document.body.firstElementChild?.tagName === 'PRE'
        ? document.body.firstElementChild
        : null;
    return pre?.innerText ?? document.body?.innerText ?? document.documentElement?.innerText ?? '';
  }

  (async () => {
    if (!(await shouldOpenInViewer())) return;

    sessionStorage.setItem(REDIRECT_FLAG, '1');

    chrome.runtime.sendMessage(
      {
        type: 'OPEN_VIEWER_FOR_SNAPSHOT',
        url: location.href,
        title: document.title || '',
        mimeType: document.contentType || '',
        text: getDocumentText()
      },
      response => {
        if (chrome.runtime.lastError || !response?.ok) {
          sessionStorage.removeItem(REDIRECT_FLAG);
          // Do not navigate to a chrome-extension:// URL from the page context.
          // Chrome may block that navigation as ERR_BLOCKED_BY_CLIENT.
          console.warn(
            'Dev File Viewer could not open this document:',
            chrome.runtime.lastError || response
          );
        }
      }
    );
  })();
})();
