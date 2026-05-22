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

    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      const lineElement = document.createElement('span');
      lineElement.className = 'source-line';
      lineElement.id = `L${lineNumber}`;
      lineElement.dataset.line = String(lineNumber);
      lineElement.innerHTML = line ? highlightCodeToHtml(line, language) : '\u200b';
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
