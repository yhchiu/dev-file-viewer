(() => {
  const EXTENSIONS = ['.md', '.mkd', '.mdx', '.markdown'];
  const REDIRECT_FLAG = 'devFileViewerRedirected';

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

  function shouldRedirect() {
    if (!hasSupportedExtension(location.href)) return false;
    if (sessionStorage.getItem(REDIRECT_FLAG) === '1') return false;
    if (!['http:', 'https:', 'file:'].includes(location.protocol)) return false;
    return isPlainTextDocument();
  }

  if (shouldRedirect()) {
    sessionStorage.setItem(REDIRECT_FLAG, '1');
    const viewerUrl = chrome.runtime.getURL(`viewer/index.html?url=${encodeURIComponent(location.href)}`);
    location.replace(viewerUrl);
  }
})();
