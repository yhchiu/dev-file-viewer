import { highlightCodeToHtml, normalizeLanguageName } from '../highlight/syntaxHighlighter.js';
import { sourceLanguageFromPath } from '../format/fileTypes.js';
import { t } from '../i18n/i18n.js';

// Upper bound on rendered lines. Each line produces several DOM nodes, so a
// pathological file (e.g. a huge minified blob) could otherwise create hundreds
// of thousands of nodes and freeze the tab. Above this we render a prefix and
// show a notice with the full line count.
export const MAX_RENDERED_LINES = 50000;

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
    const maxLines = Number.isFinite(context.maxLines) ? context.maxLines : MAX_RENDERED_LINES;
    const totalLines = lines.length;
    const renderedLines = Math.min(totalLines, maxLines);
    const lineNumberWidth = `${Math.max(3, String(renderedLines).length)}ch`;
    pre.style.setProperty('--source-line-number-width', lineNumberWidth);

    for (let index = 0; index < renderedLines; index += 1) {
      const line = lines[index];
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
    }

    pre.append(code);
    targetElement.append(pre);

    if (totalLines > renderedLines) {
      const notice = document.createElement('div');
      notice.className = 'source-truncated-notice';
      notice.setAttribute('role', 'status');
      notice.textContent = t('sourceTruncatedNotice', [
        String(renderedLines),
        String(totalLines)
      ]);
      targetElement.append(notice);
    }

    return {
      language,
      lineCount: totalLines
    };
  }
}
