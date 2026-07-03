// Pure helper functions extracted from app.js so they can be unit-tested
// without instantiating the viewer application (which has DOM/chrome side
// effects). app.js imports these; behavior is unchanged.
import { t } from '../core/i18n/i18n.js';
import { isSupportedViewerFile } from '../core/format/fileTypes.js';

export const THEME_OPTIONS = new Set(['system', 'bloom', 'forge', 'folio']);

export function immediateParentId(node) {
  const parentIds = node?.parentIds;
  return parentIds?.length ? parentIds[parentIds.length - 1] : '';
}

export function symbolKindLabel(kind) {
  switch (kind) {
    case 'class':
      return t('symbolClass');
    case 'interface':
      return t('symbolInterface');
    case 'method':
      return t('symbolMethod');
    case 'function':
      return t('symbolFunction');
    case 'type':
      return t('symbolType');
    case 'enum':
      return t('symbolEnum');
    case 'module':
      return t('symbolModule');
    default:
      return t('symbolGeneric');
  }
}

export function normalizeDroppedEntryPath(path = '') {
  const value = String(path || '').replace(/\\/g, '/');
  return value.startsWith('/') ? value.slice(1) : value;
}

export function isSupportedDroppedName(name = '') {
  return Boolean(name) && isSupportedViewerFile(String(name));
}

export function themeLabel(value) {
  switch (normalizeThemePreference(value)) {
    case 'system':
      return t('themeSystem');
    case 'forge':
      return t('themeForge');
    case 'folio':
      return t('themeFolio');
    case 'bloom':
    default:
      return t('themeBloom');
  }
}

export function normalizeThemePreference(value, fallback = 'system') {
  if (value === 'light') return 'bloom';
  if (value === 'dark') return 'forge';
  return THEME_OPTIONS.has(value) ? value : fallback;
}

export function resolveThemePreference(value, prefersDark = false) {
  const preference = normalizeThemePreference(value);
  const appTheme = preference === 'system' ? (prefersDark ? 'forge' : 'bloom') : preference;

  return {
    appTheme,
    colorScheme: appTheme === 'forge' ? 'dark' : 'light',
    preference
  };
}

export function contentWidthLabel(value) {
  switch (value) {
    case 'narrow':
      return t('contentWidthNarrow');
    case 'wide':
      return t('contentWidthWide');
    case 'full':
      return t('contentWidthFull');
    case 'comfortable':
    default:
      return t('contentWidthComfortable');
  }
}

// The two Markdown preview modes: 'rendered' (HTML) and 'source' (raw text).
export const MARKDOWN_VIEW_MODES = new Set(['rendered', 'source']);

/** The mode a rendered↔source toggle switches to from the given mode. */
export function nextMarkdownViewMode(mode) {
  return mode === 'source' ? 'rendered' : 'source';
}

/**
 * Presentation state for the Markdown source toggle button: which sprite icon
 * to show, the i18n key for its title/label (describing the action the button
 * performs), and its aria-pressed value. In rendered mode the button offers to
 * "view source"; in source mode it offers to "view rendered".
 */
export function markdownViewToggleState(mode) {
  return mode === 'source'
    ? { iconId: 'eye', i18nKey: 'a11yViewRendered', pressed: true }
    : { iconId: 'code', i18nKey: 'a11yViewSource', pressed: false };
}

export function normalizeLinkData(link) {
  if (typeof link === 'string') return { href: link, url: link, kind: 'absolute-document' };
  return link || {};
}

export function extractHash(href) {
  const value = String(href || '');
  const hashIndex = value.indexOf('#');
  return hashIndex >= 0 ? value.slice(hashIndex + 1) : '';
}

export function safeDecodeURIComponent(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
