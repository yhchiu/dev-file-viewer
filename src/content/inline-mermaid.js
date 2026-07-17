import { installInlineMermaidRenderer } from './inlineMermaidInjected.js';

const INSTALL_KEY = '__devFileViewerInlineMermaidRenderer';

if (!globalThis[INSTALL_KEY]) {
  globalThis[INSTALL_KEY] = installInlineMermaidRenderer();
}
