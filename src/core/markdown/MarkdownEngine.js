import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { features } from '../config/features.js';
import { rewriteLinks } from '../security/linkPolicy.js';

export class MarkdownEngine {
  constructor(pluginRegistry) {
    this.pluginRegistry = pluginRegistry;
    marked.setOptions({
      async: false,
      gfm: features.markdown.gfm,
      breaks: features.markdown.breaks,
      pedantic: false
    });
  }

  render(markdownText, targetElement, context = {}) {
    const dirtyHtml = marked.parse(markdownText || '');
    const cleanHtml = DOMPurify.sanitize(dirtyHtml, {
      USE_PROFILES: { html: true },
      ADD_TAGS: ['svg', 'g', 'path', 'rect', 'line', 'polyline', 'polygon', 'circle', 'ellipse', 'text', 'tspan', 'marker', 'defs', 'foreignObject', 'div', 'span'],
      ADD_ATTR: ['class', 'id', 'style', 'viewBox', 'd', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'width', 'height', 'fill', 'stroke', 'stroke-width', 'marker-end', 'transform', 'text-anchor', 'dominant-baseline']
    });

    targetElement.innerHTML = cleanHtml;
    rewriteLinks(targetElement, context.baseUrl, context.onOpenDocumentLink);
    return this.pluginRegistry.runAfterRender(targetElement, context);
  }
}
