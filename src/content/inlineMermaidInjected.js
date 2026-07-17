import { renderMermaidBlocks } from '../plugins/mermaidRenderer.js';
import {
  INLINE_MERMAID_RENDER_EVENT,
  INLINE_MERMAID_RENDERED_EVENT,
  INLINE_PREVIEW_TARGET_SELECTOR
} from './inlineMermaidProtocol.js';

function completionDetail(requestId, result = {}, error = null) {
  return {
    requestId,
    ok: !error,
    rendered: Number(result.rendered || 0),
    failed: Number(result.failed || 0),
    error: error ? error?.message || String(error) : ''
  };
}

export function installInlineMermaidRenderer(options = {}) {
  const doc = options.document || document;
  const renderer = options.renderer || renderMermaidBlocks;
  let queue = Promise.resolve();

  const onRender = event => {
    const root = event.target;
    if (!(root instanceof Element) || !root.matches(INLINE_PREVIEW_TARGET_SELECTOR)) return;

    const requestId = event.detail?.requestId || '';
    queue = queue.then(async () => {
      let result = { rendered: 0, failed: 0 };
      let error = null;
      try {
        result = await renderer(root);
      } catch (caught) {
        error = caught;
      }

      root.dispatchEvent(
        new CustomEvent(INLINE_MERMAID_RENDERED_EVENT, {
          detail: completionDetail(requestId, result, error)
        })
      );
    });
  };

  doc.addEventListener(INLINE_MERMAID_RENDER_EVENT, onRender, true);
  return () => doc.removeEventListener(INLINE_MERMAID_RENDER_EVENT, onRender, true);
}
