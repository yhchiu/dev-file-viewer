import { ensureUrlCanParse } from '../core/browser/urlCanParsePolyfill.js';
import { MERMAID_CODE_SELECTOR } from './mermaidBlocks.js';

let mermaidPromise;

// Load and initialise mermaid on first use. In the Full Viewer ESM build this
// remains a split dynamic-import chunk. In the Inline Preview it is bundled into
// a separate IIFE that is injected only after a Mermaid block is detected.
function loadMermaid() {
  // mermaid's sanitize-url dependency needs URL.canParse (Chrome 120+); the
  // extension supports Chrome 111+, so make sure a fallback is in place.
  ensureUrlCanParse();
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

function mermaidErrorMessage(error) {
  return `Mermaid render failed:\n${error?.message || error}`;
}

function replaceWithFallback(node, error, doc) {
  if (!node?.isConnected && !node?.parentNode) return;
  if (node.querySelector?.('svg')) return;

  const fallback = doc.createElement('pre');
  fallback.className = 'mermaid-error';
  fallback.textContent = mermaidErrorMessage(error);
  node.replaceWith(fallback);
}

export async function renderMermaidBlocks(root) {
  if (!root) return { rendered: 0, failed: 0 };

  const doc = root.ownerDocument || document;
  const nodes = [];
  const codeBlocks = root.querySelectorAll(MERMAID_CODE_SELECTOR);

  for (const code of codeBlocks) {
    const diagramSource = code.textContent || '';
    const container = doc.createElement('div');
    container.className = 'mermaid';
    container.textContent = diagramSource;
    code.closest('pre')?.replaceWith(container);
    nodes.push(container);
  }

  if (!nodes.length) return { rendered: 0, failed: 0 };

  try {
    const mermaid = await loadMermaid();
    await mermaid.run({ nodes });
  } catch (error) {
    for (const node of nodes) replaceWithFallback(node, error, doc);
    const rendered = nodes.filter(node => Boolean(node.querySelector('svg'))).length;
    return { rendered, failed: nodes.length - rendered };
  }

  const rendered = nodes.filter(node => Boolean(node.querySelector('svg'))).length;
  const failed = nodes.length - rendered;
  return { rendered, failed };
}
