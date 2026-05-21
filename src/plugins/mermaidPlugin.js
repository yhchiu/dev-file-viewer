import mermaid from 'mermaid';
import { features } from '../core/config/features.js';

export const mermaidPlugin = {
  id: 'mermaid',
  enabled: features.plugins.mermaid,

  async init() {
    mermaid.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'default'
    });
  },

  async afterRender(root) {
    const nodes = [];
    const codeBlocks = root.querySelectorAll('pre > code.language-mermaid, pre > code.lang-mermaid');

    for (const code of codeBlocks) {
      const diagramSource = code.textContent || '';
      const container = document.createElement('div');
      container.className = 'mermaid';
      container.textContent = diagramSource;
      code.closest('pre')?.replaceWith(container);
      nodes.push(container);
    }

    if (!nodes.length) return;

    try {
      await mermaid.run({ nodes });
    } catch (error) {
      for (const node of nodes) {
        if (node.querySelector('svg')) continue;
        const fallback = document.createElement('pre');
        fallback.className = 'mermaid-error';
        fallback.textContent = `Mermaid render failed:\n${error?.message || error}`;
        node.replaceWith(fallback);
      }
    }
  }
};
