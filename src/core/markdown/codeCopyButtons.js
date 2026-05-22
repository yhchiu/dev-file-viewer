import { t } from '../i18n/i18n.js';

const COPY_ICON = `
  <svg class="code-copy-icon code-copy-icon-copy" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <rect x="5.25" y="3.25" width="7.5" height="9.5" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.4" />
    <path d="M3.25 10.75V4.5A2.25 2.25 0 0 1 5.5 2.25h4.25" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
  </svg>`;

const CHECK_ICON = `
  <svg class="code-copy-icon code-copy-icon-check" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path d="M3.25 8.25 6.5 11.5l6.25-7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
  </svg>`;

export function installMarkdownCodeCopyButtons(root) {
  const codeBlocks = root.querySelectorAll('pre > code');

  for (const code of codeBlocks) {
    const pre = code.closest('pre');
    if (!pre || pre.querySelector(':scope > .markdown-code-toolbar')) continue;

    const rawLanguage = [...code.classList].find(className => className === 'language-mermaid' || className === 'lang-mermaid');
    if (rawLanguage) continue;

    const toolbar = document.createElement('div');
    toolbar.className = 'markdown-code-toolbar';

    const languageLabel = normalizeLanguageLabel(code.dataset.language || detectCodeLanguage(code));
    const lang = document.createElement('span');
    lang.className = 'markdown-code-language';
    lang.textContent = languageLabel;
    lang.hidden = !languageLabel;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'markdown-code-copy';
    button.title = t('a11yCopyCode');
    button.setAttribute('aria-label', t('a11yCopyCode'));
    button.innerHTML = COPY_ICON;

    button.addEventListener('click', async event => {
      event.preventDefault();
      event.stopPropagation();

      try {
        await copyText(code.textContent || '');
        setCopiedState(button);
      } catch {
        setCopyFailedState(button);
      }
    });

    toolbar.append(lang, button);
    pre.classList.add('has-code-copy-button');
    pre.append(toolbar);
  }
}

function detectCodeLanguage(code) {
  const languageClass = [...code.classList]
    .find(className => className.startsWith('language-') || className.startsWith('lang-'));

  if (!languageClass) return '';
  return languageClass.replace(/^language-/, '').replace(/^lang-/, '');
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
  button.innerHTML = CHECK_ICON;

  window.clearTimeout(button._copyTimer);
  button._copyTimer = window.setTimeout(() => {
    button.classList.remove('is-copied');
    button.title = t('a11yCopyCode');
    button.setAttribute('aria-label', t('a11yCopyCode'));
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
    button.innerHTML = COPY_ICON;
  }, 1800);
}
