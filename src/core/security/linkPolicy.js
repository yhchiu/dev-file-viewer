import { isSupportedViewerFile } from '../format/fileTypes.js';

const SAFE_SCHEMES = new Set(['http:', 'https:', 'file:', 'mailto:']);
const URL_SCHEME_RE = /^[a-zA-Z][a-zA-Z\d+.-]*:/;

export function rewriteLinks(root, baseUrl, onOpenDocumentLink, options = {}) {
  const supportedDocumentBehavior = options.supportedDocumentBehavior || 'viewer';
  for (const link of root.querySelectorAll('a[href]')) {
    const href = link.getAttribute('href');
    if (!href) continue;

    if (href.startsWith('#')) {
      link.setAttribute('rel', 'noopener noreferrer');
      continue;
    }

    const isRelative = isRelativeHref(href);

    if (isRelative && !baseUrl) {
      if (isSupportedViewerFile(stripHashAndQuery(href))) {
        link.setAttribute('rel', 'noopener noreferrer');
        if (supportedDocumentBehavior === 'viewer') {
          link.addEventListener('click', event => {
            event.preventDefault();
            onOpenDocumentLink?.({ href, kind: 'relative-document' });
          });
        }
      } else {
        link.removeAttribute('href');
      }
      continue;
    }

    let resolved;
    try {
      resolved = new URL(href, baseUrl || window.location.href);
    } catch {
      link.removeAttribute('href');
      continue;
    }

    if (!SAFE_SCHEMES.has(resolved.protocol)) {
      link.removeAttribute('href');
      continue;
    }

    link.setAttribute('href', resolved.href);
    link.setAttribute('rel', 'noopener noreferrer');

    if (isSupportedViewerFile(resolved.pathname)) {
      if (supportedDocumentBehavior === 'viewer') {
        link.addEventListener('click', event => {
          event.preventDefault();
          onOpenDocumentLink?.({
            href,
            url: resolved.href,
            kind: isRelative ? 'resolved-relative-document' : 'absolute-document'
          });
        });
      }
    } else {
      link.setAttribute('target', '_blank');
    }
  }

  for (const image of root.querySelectorAll('img[src]')) {
    const src = image.getAttribute('src');
    try {
      const resolved = new URL(src, baseUrl || window.location.href);
      if (SAFE_SCHEMES.has(resolved.protocol)) {
        image.setAttribute('src', resolved.href);
      } else {
        image.removeAttribute('src');
      }
    } catch {
      image.removeAttribute('src');
    }
  }
}

function isRelativeHref(href) {
  return !href.startsWith('//') && !URL_SCHEME_RE.test(href);
}

function stripHashAndQuery(value) {
  return String(value || '')
    .split('#', 1)[0]
    .split('?', 1)[0];
}
