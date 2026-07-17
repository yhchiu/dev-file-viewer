import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { features } from '../config/features.js';
import { rewriteLinks } from '../security/linkPolicy.js';
import { highlightMarkdownCodeBlocks } from '../highlight/syntaxHighlighter.js';
import { installMarkdownCodeCopyButtons } from './codeCopyButtons.js';

// Strip any inline-style declaration that references an external resource via
// url(...). Even though DOMPurify sanitises CSS, an `background: url(http://...)`
// in untrusted Markdown would be an "open to load a remote beacon" tracker,
// which conflicts with the privacy-first goal. Registered once (DOMPurify is a
// singleton; only MarkdownEngine calls sanitize()).
DOMPurify.addHook('uponSanitizeAttribute', (node, data) => {
  if (data.attrName !== 'style' || !/url\s*\(/i.test(data.attrValue)) return;

  const safe = data.attrValue
    .split(';')
    .filter(declaration => !/url\s*\(/i.test(declaration))
    .join(';')
    .trim();

  data.attrValue = safe;
  if (!safe) data.keepAttr = false;
});

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

  async render(markdownText, targetElement, context = {}) {
    const dirtyHtml = marked.parse(markdownText || '');
    const cleanHtml = DOMPurify.sanitize(dirtyHtml, {
      USE_PROFILES: { html: true },
      // foreignObject (XHTML inside SVG) is a classic mutation-XSS vector and is
      // not needed: mermaid renders its SVG after sanitisation, so dropping it
      // here only affects hand-authored inline SVG. Namespace user-supplied ids
      // (user-content-*) so Markdown content cannot clobber app selectors like
      // #status / #preview. Heading anchors are regenerated post-sanitise by
      // ensureHeadingAnchors(), so the TOC does not depend on these ids.
      SANITIZE_NAMED_PROPS: true,
      ADD_TAGS: [
        'svg',
        'g',
        'path',
        'rect',
        'line',
        'polyline',
        'polygon',
        'circle',
        'ellipse',
        'text',
        'tspan',
        'marker',
        'defs',
        'div',
        'span'
      ],
      ADD_ATTR: [
        'class',
        'id',
        'style',
        'viewBox',
        'd',
        'x',
        'y',
        'x1',
        'y1',
        'x2',
        'y2',
        'cx',
        'cy',
        'r',
        'rx',
        'ry',
        'width',
        'height',
        'fill',
        'stroke',
        'stroke-width',
        'marker-end',
        'transform',
        'text-anchor',
        'dominant-baseline'
      ]
    });

    // eslint-disable-next-line no-unsanitized/property -- cleanHtml is DOMPurify-sanitized output
    targetElement.innerHTML = cleanHtml;
    highlightMarkdownCodeBlocks(targetElement);
    rewriteLinks(targetElement, context.baseUrl, context.onOpenDocumentLink, context.linkOptions);
    await this.pluginRegistry.runAfterRender(targetElement, context);
    installMarkdownCodeCopyButtons(targetElement);
  }
}
