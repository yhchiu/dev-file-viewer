import { matchedAutoOpenKey } from '../core/format/fileTypes.js';
import { isAutoOpenEnabledFor, loadAutoOpenConfig } from '../core/config/autoOpen.js';
import {
  INLINE_ROOT_SELECTOR,
  findRawSourceElement,
  renderInlinePreview
} from './inlinePreview.js';

const REDIRECT_FLAG = 'devFileViewerRedirecting';

export function isPlainTextDocument(doc = document) {
  const contentType = doc.contentType || '';
  if (/^(text\/plain|text\/markdown|application\/octet-stream)/i.test(contentType)) return true;

  const body = doc.body;
  return Boolean(body && body.children.length === 1 && body.firstElementChild?.tagName === 'PRE');
}

export function getDocumentText(doc = document, sourceElement = findRawSourceElement(doc)) {
  return sourceElement?.textContent ?? doc.body?.innerText ?? doc.documentElement?.innerText ?? '';
}

function sendOpenViewerMessage(payload, session = sessionStorage) {
  session.setItem(REDIRECT_FLAG, '1');

  chrome.runtime.sendMessage(payload, response => {
    if (chrome.runtime.lastError || !response?.ok) {
      session.removeItem(REDIRECT_FLAG);
      console.warn(
        'Dev File Viewer could not open this document:',
        chrome.runtime.lastError || response
      );
    }
  });
}

export async function runAutoView(options = {}) {
  const doc = options.document || document;
  const locationObject = options.location || location;
  const session = options.sessionStorage || sessionStorage;
  const url = locationObject.href;
  const key = matchedAutoOpenKey(url);

  if (!key) return 'ignored';
  if (session.getItem(REDIRECT_FLAG) === '1') return 'ignored';
  if (!['http:', 'https:', 'file:'].includes(locationObject.protocol)) return 'ignored';
  if (doc.querySelector(INLINE_ROOT_SELECTOR)) return 'inline';
  if (!isPlainTextDocument(doc)) return 'ignored';

  const config = await loadAutoOpenConfig(options.storageArea || chrome.storage.local);
  if (!isAutoOpenEnabledFor(config, key)) return 'ignored';

  const sourceElement = findRawSourceElement(doc);
  const input = {
    url,
    title: doc.title || '',
    mimeType: doc.contentType || '',
    text: getDocumentText(doc, sourceElement)
  };

  if (config.inlinePreview) {
    const mounted = await renderInlinePreview(input, { ...options, document: doc, sourceElement });
    if (mounted) return 'inline';
  }

  sendOpenViewerMessage(
    {
      type: 'OPEN_VIEWER_FOR_SNAPSHOT',
      disposition: 'current-tab',
      ...input
    },
    session
  );
  return 'full-viewer';
}
