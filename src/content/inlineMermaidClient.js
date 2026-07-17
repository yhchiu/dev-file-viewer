import { hasMermaidCodeBlocks } from '../plugins/mermaidBlocks.js';
import {
  INLINE_MERMAID_RENDER_EVENT,
  INLINE_MERMAID_RENDERED_EVENT,
  LOAD_INLINE_MERMAID_MESSAGE
} from './inlineMermaidProtocol.js';

const DEFAULT_RENDER_TIMEOUT_MS = 15000;

function runtimeMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, response => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      if (!response?.ok) {
        reject(new Error(response?.error || 'Dev File Viewer request failed.'));
        return;
      }
      resolve(response);
    });
  });
}

function createRequestId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export class InlineMermaidClient {
  constructor(options = {}) {
    this.sendMessage = options.sendMessage || runtimeMessage;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_RENDER_TIMEOUT_MS;
    this.loaderPromise = null;
  }

  hasDiagram(root) {
    return hasMermaidCodeBlocks(root);
  }

  async ensureLoaded() {
    if (!this.loaderPromise) {
      this.loaderPromise = this.sendMessage({ type: LOAD_INLINE_MERMAID_MESSAGE }).catch(error => {
        this.loaderPromise = null;
        throw error;
      });
    }
    await this.loaderPromise;
  }

  async render(root) {
    if (!this.hasDiagram(root)) return { requested: false, rendered: 0, failed: 0 };

    await this.ensureLoaded();
    const requestId = createRequestId();

    return new Promise((resolve, reject) => {
      let timer = null;

      const cleanup = () => {
        root.removeEventListener(INLINE_MERMAID_RENDERED_EVENT, onRendered);
        if (timer) clearTimeout(timer);
      };

      const onRendered = event => {
        if (event.detail?.requestId !== requestId) return;
        cleanup();
        if (event.detail?.ok === false) {
          reject(new Error(event.detail?.error || 'Mermaid rendering failed.'));
          return;
        }
        resolve({
          requested: true,
          rendered: Number(event.detail?.rendered || 0),
          failed: Number(event.detail?.failed || 0)
        });
      };

      root.addEventListener(INLINE_MERMAID_RENDERED_EVENT, onRendered);
      timer = setTimeout(() => {
        cleanup();
        reject(new Error('Timed out while rendering Mermaid diagrams.'));
      }, this.timeoutMs);

      root.dispatchEvent(
        new CustomEvent(INLINE_MERMAID_RENDER_EVENT, {
          detail: { requestId }
        })
      );
    });
  }
}
