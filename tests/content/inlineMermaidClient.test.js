import { afterEach, describe, expect, it, vi } from 'vitest';
import { InlineMermaidClient } from '../../src/content/inlineMermaidClient.js';
import {
  INLINE_MERMAID_RENDER_EVENT,
  INLINE_MERMAID_RENDERED_EVENT,
  LOAD_INLINE_MERMAID_MESSAGE
} from '../../src/content/inlineMermaidProtocol.js';

function previewRoot(markdownClass = 'language-mermaid') {
  const root = document.createElement('main');
  root.dataset.dfvPreview = '';
  root.innerHTML = `<pre><code class="${markdownClass}">graph TD; A--&gt;B;</code></pre>`;
  document.body.append(root);
  return root;
}

function completeRender(root, result = { rendered: 1, failed: 0 }) {
  root.addEventListener(INLINE_MERMAID_RENDER_EVENT, event => {
    root.dispatchEvent(
      new CustomEvent(INLINE_MERMAID_RENDERED_EVENT, {
        detail: { requestId: event.detail.requestId, ok: true, ...result }
      })
    );
  });
}

afterEach(() => {
  document.body.textContent = '';
});

describe('InlineMermaidClient', () => {
  it('does not load the Mermaid bundle when the preview has no diagram', async () => {
    const sendMessage = vi.fn(async () => ({ ok: true }));
    const root = previewRoot('language-js');
    const client = new InlineMermaidClient({ sendMessage });

    await expect(client.render(root)).resolves.toEqual({
      requested: false,
      rendered: 0,
      failed: 0
    });
    expect(sendMessage).not.toHaveBeenCalled();
  });

  it('loads once and requests rendering for each Mermaid preview pass', async () => {
    const sendMessage = vi.fn(async () => ({ ok: true }));
    const root = previewRoot();
    completeRender(root);
    const client = new InlineMermaidClient({ sendMessage });

    await expect(client.render(root)).resolves.toEqual({
      requested: true,
      rendered: 1,
      failed: 0
    });
    await expect(client.render(root)).resolves.toEqual({
      requested: true,
      rendered: 1,
      failed: 0
    });

    expect(sendMessage).toHaveBeenCalledTimes(1);
    expect(sendMessage).toHaveBeenCalledWith({ type: LOAD_INLINE_MERMAID_MESSAGE });
  });

  it('resets the loader promise after an injection failure so a retry can succeed', async () => {
    const sendMessage = vi
      .fn()
      .mockRejectedValueOnce(new Error('injection denied'))
      .mockResolvedValueOnce({ ok: true });
    const root = previewRoot();
    completeRender(root);
    const client = new InlineMermaidClient({ sendMessage });

    await expect(client.render(root)).rejects.toThrow('injection denied');
    await expect(client.render(root)).resolves.toEqual(
      expect.objectContaining({ requested: true, rendered: 1 })
    );
    expect(sendMessage).toHaveBeenCalledTimes(2);
  });

  it('rejects when the injected renderer reports an unexpected failure', async () => {
    const root = previewRoot();
    root.addEventListener(INLINE_MERMAID_RENDER_EVENT, event => {
      root.dispatchEvent(
        new CustomEvent(INLINE_MERMAID_RENDERED_EVENT, {
          detail: {
            requestId: event.detail.requestId,
            ok: false,
            error: 'renderer crashed'
          }
        })
      );
    });
    const client = new InlineMermaidClient({ sendMessage: vi.fn(async () => ({ ok: true })) });

    await expect(client.render(root)).rejects.toThrow('renderer crashed');
  });
});
