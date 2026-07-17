export const MERMAID_CODE_SELECTOR = 'pre > code.language-mermaid, pre > code.lang-mermaid';

export function hasMermaidCodeBlocks(root) {
  return Boolean(root?.querySelector?.(MERMAID_CODE_SELECTOR));
}
