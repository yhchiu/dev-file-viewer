// Pure helper functions extracted from app.js so they can be unit-tested
// without instantiating the viewer application (which has DOM/chrome side
// effects). app.js imports these; behavior is unchanged.
import { t } from '../core/i18n/i18n.js';

export function immediateParentId(node) {
  const parentIds = node?.parentIds;
  return parentIds?.length ? parentIds[parentIds.length - 1] : '';
}

export function symbolKindLabel(kind) {
  switch (kind) {
    case 'class': return t('symbolClass');
    case 'interface': return t('symbolInterface');
    case 'method': return t('symbolMethod');
    case 'function': return t('symbolFunction');
    case 'type': return t('symbolType');
    case 'enum': return t('symbolEnum');
    case 'module': return t('symbolModule');
    default: return t('symbolGeneric');
  }
}

export function normalizeDroppedEntryPath(path = '') {
  const value = String(path || '').replace(/\\/g, '/');
  return value.startsWith('/') ? value.slice(1) : value;
}

export function isSupportedDroppedName(name = '') {
  const value = String(name || '').toLowerCase();
  return Boolean(value) && (
    value.endsWith('.md') || value.endsWith('.mkd') || value.endsWith('.mdx') || value.endsWith('.markdown') ||
    value.endsWith('.diff') || value.endsWith('.patch') ||
    value.endsWith('.txt') || value.endsWith('.text') ||
    value.endsWith('.js') || value.endsWith('.mjs') || value.endsWith('.cjs') || value.endsWith('.jsx') ||
    value.endsWith('.ts') || value.endsWith('.tsx') ||
    value.endsWith('.html') || value.endsWith('.htm') || value.endsWith('.css') ||
    value.endsWith('.json') || value.endsWith('.jsonc') || value.endsWith('.yaml') || value.endsWith('.yml') ||
    value.endsWith('.toml') || value.endsWith('.ini') || value.endsWith('.xml') || value.endsWith('.svg') ||
    value.endsWith('.sh') || value.endsWith('.bash') || value.endsWith('.zsh') || value.endsWith('.ps1') ||
    value.endsWith('.py') || value.endsWith('.go') || value.endsWith('.java') ||
    value.endsWith('.c') || value.endsWith('.h') || value.endsWith('.cpp') || value.endsWith('.cc') ||
    value.endsWith('.cxx') || value.endsWith('.hpp') || value.endsWith('.hh') || value.endsWith('.hxx') ||
    value.endsWith('.rs') || value.endsWith('.cs') || value.endsWith('.php') || value.endsWith('.rb') ||
    value.endsWith('.sql') || value.endsWith('.swift') || value.endsWith('.kt') || value.endsWith('.kts') ||
    value.endsWith('.scala') || value.endsWith('.dart') || value.endsWith('.lua') || value.endsWith('.r') ||
    value.endsWith('.pl') || value.endsWith('.pm') || value.endsWith('.ex') || value.endsWith('.exs') ||
    value.endsWith('.erl') || value.endsWith('.hrl') || value.endsWith('.clj') || value.endsWith('.cljs') ||
    value.endsWith('.groovy') || value.endsWith('.gradle') || value.endsWith('.vue') || value.endsWith('.svelte') ||
    value.endsWith('.dockerfile') || value.endsWith('.makefile') || value.endsWith('.cmake') ||
    ['makefile', 'dockerfile', 'cmakelists.txt', 'gemfile', 'rakefile', 'justfile', 'procfile'].includes(value) ||
    value.startsWith('.gitignore') || value.startsWith('.gitattributes') || value.startsWith('.env')
  );
}

export function themeLabel(value) {
  switch (value) {
    case 'dark': return t('themeDark');
    case 'system': return t('themeSystem');
    case 'light':
    default:
      return t('themeLight');
  }
}

export function contentWidthLabel(value) {
  switch (value) {
    case 'narrow': return t('contentWidthNarrow');
    case 'wide': return t('contentWidthWide');
    case 'full': return t('contentWidthFull');
    case 'comfortable':
    default:
      return t('contentWidthComfortable');
  }
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
