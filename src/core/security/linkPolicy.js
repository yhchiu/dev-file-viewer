import { isSupportedDocumentFile } from '../format/fileTypes.js';

const SAFE_SCHEMES = new Set(['http:', 'https:', 'file:', 'mailto:']);

export function rewriteLinks(root, baseUrl, onOpenDocumentLink) {
  for (const link of root.querySelectorAll('a[href]')) {
    const href = link.getAttribute('href');
    if (!href || href.startsWith('#')) continue;

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

    if (isSupportedDocumentFile(resolved.pathname)) {
      link.addEventListener('click', event => {
        event.preventDefault();
        onOpenDocumentLink?.(resolved.href);
      });
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
