import { features } from '../core/config/features.js';

let mermaidPromise;

// Load and initialise mermaid on first use. mermaid (with d3/cytoscape) is by
// far the largest dependency, so importing it dynamically keeps it out of the
// viewer's initial bundle and only pays the download/parse cost when a document
// actually contains a diagram.
function loadMermaid() {
  if (!mermaidPromise) {
    mermaidPromise = import('mermaid').then(({ default: mermaid }) => {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: 'strict',
        theme: 'default'
      });
      return mermaid;
    });
  }
  return mermaidPromise;
}

export const mermaidPlugin = {
  id: 'mermaid',
  enabled: features.plugins.mermaid,

  // Initialisation is deferred to the first afterRender that finds a diagram.
  async init() {},

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

    const mermaid = await loadMermaid();

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
