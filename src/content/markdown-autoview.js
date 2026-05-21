(() => {
  const EXTENSIONS = ['.md', '.mkd', '.mdx', '.markdown'];
  const REDIRECT_FLAG = 'devFileViewerRedirecting';

  function hasSupportedExtension(url) {
    try {
      const path = new URL(url).pathname.toLowerCase();
      return EXTENSIONS.some(ext => path.endsWith(ext));
    } catch {
      return false;
    }
  }

  function isPlainTextDocument() {
    const contentType = document.contentType || '';
    if (/^(text\/plain|text\/markdown|application\/octet-stream)/i.test(contentType)) return true;

    // Chrome often displays raw text documents as a body with one PRE element.
    const body = document.body;
    return Boolean(body && body.children.length === 1 && body.firstElementChild?.tagName === 'PRE');
  }

  function shouldOpenInViewer() {
    if (!hasSupportedExtension(location.href)) return false;
    if (sessionStorage.getItem(REDIRECT_FLAG) === '1') return false;
    if (!['http:', 'https:', 'file:'].includes(location.protocol)) return false;
    return isPlainTextDocument();
  }

  function getDocumentText() {
    const pre = document.body?.children?.length === 1 && document.body.firstElementChild?.tagName === 'PRE'
      ? document.body.firstElementChild
      : null;
    return pre?.innerText ?? document.body?.innerText ?? document.documentElement?.innerText ?? '';
  }

  if (!shouldOpenInViewer()) return;

  sessionStorage.setItem(REDIRECT_FLAG, '1');

  chrome.runtime.sendMessage({
    type: 'OPEN_VIEWER_FOR_SNAPSHOT',
    url: location.href,
    title: document.title || '',
    mimeType: document.contentType || '',
    text: getDocumentText()
  }, response => {
    if (chrome.runtime.lastError || !response?.ok) {
      sessionStorage.removeItem(REDIRECT_FLAG);
      // Do not navigate to a chrome-extension:// URL from the page context.
      // Chrome may block that navigation as ERR_BLOCKED_BY_CLIENT.
      console.warn('Dev File Viewer could not open this document:', chrome.runtime.lastError || response);
    }
  });
})();
