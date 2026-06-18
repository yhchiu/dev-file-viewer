import { highlightCodeToHtml, normalizeLanguageName } from '../highlight/syntaxHighlighter.js';
import { sourceLanguageFromPath } from '../format/fileTypes.js';

export class SourceCodeRenderer {
  render(sourceText, targetElement, context = {}) {
    const language = normalizeLanguageName(context.language || sourceLanguageFromPath(context.name || context.url || context.path || ''));

    targetElement.textContent = '';
    const pre = document.createElement('pre');
    pre.className = 'source-code-pre';

    const code = document.createElement('code');
    code.className = language ? `language-${language} hljs source-code-lines` : 'hljs source-code-lines';
    if (language && language !== 'plaintext') code.dataset.language = language;

    const normalizedText = String(sourceText || '').replace(/\r\n?/g, '\n');
    const lines = normalizedText.split('\n');
    const lineNumberWidth = `${Math.max(3, String(lines.length).length)}ch`;
    pre.style.setProperty('--source-line-number-width', lineNumberWidth);

    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      const lineElement = document.createElement('span');
      lineElement.className = 'source-line';
      lineElement.id = `L${lineNumber}`;
      lineElement.dataset.line = String(lineNumber);

      const marker = document.createElement('span');
      marker.className = 'source-line-marker';
      marker.setAttribute('aria-hidden', 'true');

      const number = document.createElement('span');
      number.className = 'source-line-number';
      number.textContent = String(lineNumber);
      number.setAttribute('aria-hidden', 'true');

      const codeText = document.createElement('span');
      codeText.className = 'source-line-code';
      // Trusted sink: highlightCodeToHtml() returns highlight.js output (input is
      // HTML-escaped) or escapeHtml() for unknown/plaintext, so this is safe to set
      // as innerHTML without DOMPurify.
      codeText.innerHTML = line ? highlightCodeToHtml(line, language) : '\u200b';

      lineElement.append(marker, number, codeText);
      code.append(lineElement);
    });

    pre.append(code);
    targetElement.append(pre);

    return {
      language,
      lineCount: lines.length
    };
  }
}
