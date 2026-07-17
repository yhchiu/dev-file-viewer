import { INLINE_MERMAID_ENTRY_FILE } from '../content/inlineMermaidProtocol.js';

export async function injectInlineMermaid(sender, scripting = chrome.scripting) {
  const tabId = sender.tab?.id;
  if (typeof tabId !== 'number') throw new Error('Missing sender tab.');

  const frameId = Number.isInteger(sender.frameId) ? sender.frameId : 0;
  await scripting.executeScript({
    target: { tabId, frameIds: [frameId] },
    files: [INLINE_MERMAID_ENTRY_FILE]
  });

  return { ok: true };
}
