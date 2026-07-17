import { afterEach, describe, expect, it, vi } from 'vitest';
import { installInlineMermaidRenderer } from '../../src/content/inlineMermaidInjected.js';
import {
  INLINE_MERMAID_RENDER_EVENT,
  INLINE_MERMAID_RENDERED_EVENT
} from '../../src/content/inlineMermaidProtocol.js';

function inlinePreviewTarget() {
  const shell = document.createElement('div');
  shell.dataset.dfvInlineRoot = '';
  const preview = document.createElement('main');
  preview.dataset.dfvPreview = '';
  shell.append(preview);
  document.body.append(shell);
  return preview;
}

function completionFor(root, requestId) {
  return new Promise(resolve => {
    const onCompletion = event => {
      if (event.detail.requestId !== requestId) return;
      root.removeEventListener(INLINE_MERMAID_RENDERED_EVENT, onCompletion);
      resolve(event.detail);
    };
    root.addEventListener(INLINE_MERMAID_RENDERED_EVENT, onCompletion);
  });
}

afterEach(() => {
  document.body.textContent = '';
});

describe('installInlineMermaidRenderer', () => {
  it('renders a valid Inline Preview target and reports completion', async () => {
    const preview = inlinePreviewTarget();
    const renderer = vi.fn(async () => ({ rendered: 2, failed: 0 }));
    const uninstall = installInlineMermaidRenderer({ document, renderer });
    const completion = completionFor(preview, 'request-1');

    preview.dispatchEvent(
      new CustomEvent(INLINE_MERMAID_RENDER_EVENT, {
        detail: { requestId: 'request-1' }
      })
    );

    await expect(completion).resolves.toEqual({
      requestId: 'request-1',
      ok: true,
      rendered: 2,
      failed: 0,
      error: ''
    });
    expect(renderer).toHaveBeenCalledWith(preview);
    uninstall();
  });

  it('serializes multiple render requests', async () => {
    const preview = inlinePreviewTarget();
    let releaseFirst;
    const firstGate = new Promise(resolve => {
      releaseFirst = resolve;
    });
    const order = [];
    const renderer = vi
      .fn()
      .mockImplementationOnce(async () => {
        order.push('first-start');
        await firstGate;
        order.push('first-end');
        return { rendered: 1, failed: 0 };
      })
      .mockImplementationOnce(async () => {
        order.push('second');
        return { rendered: 1, failed: 0 };
      });
    const uninstall = installInlineMermaidRenderer({ document, renderer });
    const first = completionFor(preview, 'first');
    const second = completionFor(preview, 'second');

    preview.dispatchEvent(
      new CustomEvent(INLINE_MERMAID_RENDER_EVENT, { detail: { requestId: 'first' } })
    );
    preview.dispatchEvent(
      new CustomEvent(INLINE_MERMAID_RENDER_EVENT, { detail: { requestId: 'second' } })
    );
    await Promise.resolve();
    expect(order).toEqual(['first-start']);

    releaseFirst();
    await Promise.all([first, second]);
    expect(order).toEqual(['first-start', 'first-end', 'second']);
    uninstall();
  });

  it('reports unexpected renderer errors instead of leaving the client waiting', async () => {
    const preview = inlinePreviewTarget();
    const renderer = vi.fn(async () => {
      throw new Error('boom');
    });
    const uninstall = installInlineMermaidRenderer({ document, renderer });
    const completion = completionFor(preview, 'request-2');

    preview.dispatchEvent(
      new CustomEvent(INLINE_MERMAID_RENDER_EVENT, {
        detail: { requestId: 'request-2' }
      })
    );

    await expect(completion).resolves.toEqual(
      expect.objectContaining({ requestId: 'request-2', ok: false, error: 'boom' })
    );
    uninstall();
  });

  it('ignores render events outside an Inline Preview target', async () => {
    const renderer = vi.fn(async () => ({ rendered: 1, failed: 0 }));
    const uninstall = installInlineMermaidRenderer({ document, renderer });
    const other = document.createElement('main');
    document.body.append(other);

    other.dispatchEvent(
      new CustomEvent(INLINE_MERMAID_RENDER_EVENT, {
        bubbles: true,
        detail: { requestId: 'ignored' }
      })
    );
    await Promise.resolve();

    expect(renderer).not.toHaveBeenCalled();
    uninstall();
  });
});
