import { describe, expect, it, vi } from 'vitest';
import { injectInlineMermaid } from '../../src/background/inlineMermaid.js';
import { INLINE_MERMAID_ENTRY_FILE } from '../../src/content/inlineMermaidProtocol.js';

describe('injectInlineMermaid', () => {
  it('injects the lazy Mermaid bundle into the sender frame', async () => {
    const scripting = { executeScript: vi.fn(async () => []) };

    await expect(injectInlineMermaid({ tab: { id: 42 }, frameId: 7 }, scripting)).resolves.toEqual({
      ok: true
    });

    expect(scripting.executeScript).toHaveBeenCalledWith({
      target: { tabId: 42, frameIds: [7] },
      files: [INLINE_MERMAID_ENTRY_FILE]
    });
  });

  it('defaults to the top frame and rejects messages without a sender tab', async () => {
    const scripting = { executeScript: vi.fn(async () => []) };

    await injectInlineMermaid({ tab: { id: 8 } }, scripting);
    expect(scripting.executeScript).toHaveBeenCalledWith(
      expect.objectContaining({ target: { tabId: 8, frameIds: [0] } })
    );

    await expect(injectInlineMermaid({}, scripting)).rejects.toThrow('Missing sender tab');
  });
});
