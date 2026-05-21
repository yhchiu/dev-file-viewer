export const DOCUMENT_EXTENSIONS = new Set(['.md', '.mkd', '.mdx', '.markdown']);

export const FORMAT_IDS = Object.freeze({
  MARKDOWN: 'markdown',
  UNKNOWN: 'unknown',
  // Reserved for V2.
  DIFF: 'diff',
  SOURCE_CODE: 'source-code'
});

export function getExtension(value = '') {
  const cleanValue = String(value).split(/[?#]/, 1)[0];
  const slashIndex = cleanValue.lastIndexOf('/');
  const fileName = slashIndex >= 0 ? cleanValue.slice(slashIndex + 1) : cleanValue;
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex <= 0) return '';
  return fileName.slice(dotIndex).toLowerCase();
}

export function isSupportedDocumentFile(value = '') {
  return DOCUMENT_EXTENSIONS.has(getExtension(value));
}

export function detectFormat({ url = '', name = '', mimeType = '' } = {}) {
  const target = name || url;
  if (isSupportedDocumentFile(target)) return FORMAT_IDS.MARKDOWN;
  if (/markdown|mdx/i.test(mimeType)) return FORMAT_IDS.MARKDOWN;
  return FORMAT_IDS.UNKNOWN;
}

export function displayNameFromUrl(url = '') {
  try {
    const parsed = new URL(url);
    const parts = decodeURIComponent(parsed.pathname).split('/').filter(Boolean);
    return parts.at(-1) || parsed.hostname || 'Untitled';
  } catch {
    const parts = String(url).split(/[\\/]/).filter(Boolean);
    return parts.at(-1) || 'Untitled';
  }
}
