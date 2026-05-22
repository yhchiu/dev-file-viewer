// Lightweight wrapper around chrome.i18n for both DOM and worker contexts.
//
// chrome.i18n only substitutes __MSG_*__ tokens in the manifest and CSS, never
// in HTML. localizeDocument() fills annotated elements at runtime; t() resolves
// dynamic strings built in JavaScript.

/**
 * Resolve a message key. Returns the key itself when the message is missing so
 * that gaps are visible in the UI instead of rendering as blank text.
 *
 * @param {string} key
 * @param {string|string[]} [substitutions] positional values for $N$ placeholders
 * @returns {string}
 */
export function t(key, substitutions) {
  try {
    return chrome.i18n.getMessage(key, substitutions) || key;
  } catch {
    return key;
  }
}

const ATTRIBUTE_BINDINGS = [
  ['data-i18n-title', 'title'],
  ['data-i18n-aria-label', 'aria-label'],
  ['data-i18n-placeholder', 'placeholder'],
  ['data-i18n-alt', 'alt']
];

/**
 * Localize every element annotated with data-i18n* attributes within `root`,
 * then sync the document language. Safe to call once per page on load.
 *
 * @param {ParentNode} [root=document]
 */
export function localizeDocument(root = document) {
  for (const el of root.querySelectorAll('[data-i18n]')) {
    el.textContent = t(el.getAttribute('data-i18n'));
  }

  for (const [dataAttr, targetAttr] of ATTRIBUTE_BINDINGS) {
    for (const el of root.querySelectorAll(`[${dataAttr}]`)) {
      el.setAttribute(targetAttr, t(el.getAttribute(dataAttr)));
    }
  }

  syncDocumentLanguage();
}

function syncDocumentLanguage() {
  try {
    const locale = chrome.i18n.getMessage('@@ui_locale');
    if (locale) document.documentElement.lang = locale.replace(/_/g, '-');
  } catch {
    // Non-DOM context or unavailable API; nothing to sync.
  }
}
