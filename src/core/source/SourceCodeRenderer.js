import { highlightMarkdownCodeBlocks } from '../highlight/syntaxHighlighter.js';
import { sourceLanguageFromPath } from '../format/fileTypes.js';

export class SourceCodeRenderer {
  render(sourceText, targetElement, context = {}) {
    const language = context.language || sourceLanguageFromPath(context.name || context.url || context.path || '');

    targetElement.textContent = '';
    const pre = document.createElement('pre');
    pre.className = 'source-code-pre';

    const code = document.createElement('code');
    code.className = language ? `language-${language}` : '';
    code.textContent = sourceText || '';

    pre.append(code);
    targetElement.append(pre);
    highlightMarkdownCodeBlocks(targetElement);
  }
}
