import { t } from '../i18n/i18n.js';
import { getCopyIcon, getCheckIcon } from './icons.js';

const COPY_ICON = getCopyIcon('code-copy-icon code-copy-icon-copy');

const CHECK_ICON = getCheckIcon('code-copy-icon code-copy-icon-check');

// Shared language pill + copy button used by Markdown fences and the source
// file view. Callers pass getText() so source files can copy the original
// buffer instead of the numbered DOM.
export function installCodeCopyToolbar(pre, { language = '', getText } = {}) {
  if (!pre || pre.querySelector(':scope > .markdown-code-toolbar')) return null;

  const toolbar = document.createElement('div');
  toolbar.className = 'markdown-code-toolbar';

  const languageLabel = normalizeLanguageLabel(language);
  const lang = document.createElement('span');
  lang.className = 'markdown-code-language';
  lang.textContent = languageLabel;
  lang.hidden = !languageLabel;

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'markdown-code-copy';
  button.title = t('a11yCopyCode');
  button.setAttribute('aria-label', t('a11yCopyCode'));
  // eslint-disable-next-line no-unsanitized/property -- trusted static SVG icon constant
  button.innerHTML = COPY_ICON;

  button.addEventListener('click', async event => {
    event.preventDefault();
    event.stopPropagation();

    try {
      await copyText(typeof getText === 'function' ? getText() || '' : '');
      setCopiedState(button);
    } catch {
      setCopyFailedState(button);
    }
  });

  toolbar.append(lang, button);
  pre.classList.add('has-code-copy-button');
  pre.append(toolbar);
  return toolbar;
}

function normalizeLanguageLabel(value = '') {
  const label = String(value || '').trim();
  if (!label || label.toLowerCase() === 'plain text') return '';
  return label.toUpperCase();
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', '');
  textarea.style.position = 'fixed';
  textarea.style.top = '-9999px';
  textarea.style.opacity = '0';
  document.body.append(textarea);
  textarea.select();

  try {
    if (!document.execCommand('copy')) throw new Error('copy command failed');
  } finally {
    textarea.remove();
  }
}

function setCopiedState(button) {
  button.classList.remove('is-copy-failed');
  button.classList.add('is-copied');
  button.title = t('a11yCopied');
  button.setAttribute('aria-label', t('a11yCopied'));
  // eslint-disable-next-line no-unsanitized/property -- trusted static SVG icon constant
  button.innerHTML = CHECK_ICON;

  window.clearTimeout(button._copyTimer);
  button._copyTimer = window.setTimeout(() => {
    button.classList.remove('is-copied');
    button.title = t('a11yCopyCode');
    button.setAttribute('aria-label', t('a11yCopyCode'));
    // eslint-disable-next-line no-unsanitized/property -- trusted static SVG icon constant
    button.innerHTML = COPY_ICON;
  }, 1400);
}

function setCopyFailedState(button) {
  button.classList.remove('is-copied');
  button.classList.add('is-copy-failed');
  button.title = t('a11yCopyFailed');
  button.setAttribute('aria-label', t('a11yCopyFailed'));

  window.clearTimeout(button._copyTimer);
  button._copyTimer = window.setTimeout(() => {
    button.classList.remove('is-copy-failed');
    button.title = t('a11yCopyCode');
    button.setAttribute('aria-label', t('a11yCopyCode'));
    // eslint-disable-next-line no-unsanitized/property -- trusted static SVG icon constant
    button.innerHTML = COPY_ICON;
  }, 1800);
}
