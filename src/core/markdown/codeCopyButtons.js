import { installCodeCopyToolbar } from '../ui/codeCopyToolbar.js';

export function installMarkdownCodeCopyButtons(root) {
  const codeBlocks = root.querySelectorAll('pre > code');

  for (const code of codeBlocks) {
    const pre = code.closest('pre');
    if (!pre || pre.querySelector(':scope > .markdown-code-toolbar')) continue;

    const rawLanguage = [...code.classList].find(
      className => className === 'language-mermaid' || className === 'lang-mermaid'
    );
    if (rawLanguage) continue;

    installCodeCopyToolbar(pre, {
      language: code.dataset.language || detectCodeLanguage(code),
      getText: () => code.textContent || ''
    });
  }
}

function detectCodeLanguage(code) {
  const languageClass = [...code.classList].find(
    className => className.startsWith('language-') || className.startsWith('lang-')
  );

  if (!languageClass) return '';
  return languageClass.replace(/^language-/, '').replace(/^lang-/, '');
}
