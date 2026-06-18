import { describe, it, expect, vi, beforeEach } from 'vitest';

// Avoid loading the real (very large) mermaid bundle.
vi.mock('mermaid', () => ({
  default: { initialize: vi.fn(), run: vi.fn().mockResolvedValue(undefined) }
}));

import mermaid from 'mermaid';
import { mermaidPlugin } from '../../src/plugins/mermaidPlugin.js';

function rootWithDiagram() {
  const root = document.createElement('div');
  root.innerHTML = '<pre><code class="language-mermaid">graph TD; A--&gt;B;</code></pre>';
  return root;
}

beforeEach(() => {
  mermaid.run.mockReset();
  mermaid.run.mockResolvedValue(undefined);
});

describe('mermaidPlugin.init', () => {
  it('defers loading: init() is a no-op that resolves', async () => {
    await expect(mermaidPlugin.init()).resolves.toBeUndefined();
  });
});

describe('mermaidPlugin.afterRender', () => {
  it('replaces mermaid code blocks, lazily initialises with strict security, and runs', async () => {
    const root = rootWithDiagram();
    await mermaidPlugin.afterRender(root);

    const container = root.querySelector('div.mermaid');
    expect(container).not.toBeNull();
    expect(container.textContent).toContain('graph TD');
    expect(root.querySelector('pre')).toBeNull();
    expect(mermaid.initialize).toHaveBeenCalledWith(
      expect.objectContaining({ securityLevel: 'strict', startOnLoad: false })
    );
    expect(mermaid.run).toHaveBeenCalledTimes(1);
  });

  it('renders a fallback message when mermaid throws', async () => {
    mermaid.run.mockRejectedValueOnce(new Error('bad diagram'));
    const root = rootWithDiagram();
    await mermaidPlugin.afterRender(root);

    const fallback = root.querySelector('pre.mermaid-error');
    expect(fallback).not.toBeNull();
    expect(fallback.textContent).toContain('bad diagram');
  });

  it('does nothing when there are no mermaid blocks', async () => {
    const root = document.createElement('div');
    root.innerHTML = '<pre><code class="language-js">x</code></pre>';
    await mermaidPlugin.afterRender(root);
    expect(mermaid.run).not.toHaveBeenCalled();
  });
});
