import { features } from '../core/config/features.js';
import { renderMermaidBlocks } from './mermaidRenderer.js';

export const mermaidPlugin = {
  id: 'mermaid',
  enabled: features.plugins.mermaid,

  // Initialisation is deferred to the first afterRender that finds a diagram.
  async init() {},

  async afterRender(root) {
    return renderMermaidBlocks(root);
  }
};
