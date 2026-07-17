import { describe, it, expect, vi } from 'vitest';
import { rewriteLinks } from '../../../src/core/security/linkPolicy.js';

function build(html) {
  const root = document.createElement('div');
  root.innerHTML = html;
  return root;
}

function click(el) {
  const event = new window.MouseEvent('click', { bubbles: true, cancelable: true });
  el.dispatchEvent(event);
  return event;
}

describe('rewriteLinks — dangerous schemes', () => {
  it('removes javascript: hrefs', () => {
    const root = build('<a href="javascript:alert(1)">x</a>');
    rewriteLinks(root);
    expect(root.querySelector('a').hasAttribute('href')).toBe(false);
  });

  it('removes data: and vbscript: hrefs', () => {
    const root = build(
      '<a id="d" href="data:text/html,<script>1</script>">d</a><a id="v" href="vbscript:msgbox">v</a>'
    );
    rewriteLinks(root);
    expect(root.querySelector('#d').hasAttribute('href')).toBe(false);
    expect(root.querySelector('#v').hasAttribute('href')).toBe(false);
  });

  it('removes javascript:/data: image sources', () => {
    const root = build(
      '<img id="a" src="javascript:alert(1)"><img id="b" src="data:image/png;base64,AAAA">'
    );
    rewriteLinks(root);
    expect(root.querySelector('#a').hasAttribute('src')).toBe(false);
    expect(root.querySelector('#b').hasAttribute('src')).toBe(false);
  });
});

describe('rewriteLinks — safe schemes', () => {
  it('keeps http(s) and adds rel + target for non-viewer links', () => {
    const root = build('<a href="https://example.com/page">x</a>');
    rewriteLinks(root);
    const a = root.querySelector('a');
    expect(a.getAttribute('href')).toBe('https://example.com/page');
    expect(a.getAttribute('rel')).toBe('noopener noreferrer');
    expect(a.getAttribute('target')).toBe('_blank');
  });

  it('keeps mailto: links', () => {
    const root = build('<a href="mailto:a@b.com">mail</a>');
    rewriteLinks(root);
    expect(root.querySelector('a').getAttribute('href')).toBe('mailto:a@b.com');
  });

  it('keeps hash anchors with rel', () => {
    const root = build('<a href="#section">jump</a>');
    rewriteLinks(root);
    const a = root.querySelector('a');
    expect(a.getAttribute('href')).toBe('#section');
    expect(a.getAttribute('rel')).toBe('noopener noreferrer');
  });

  it('resolves relative image src against baseUrl; keeps file:// images', () => {
    const root = build('<img id="rel" src="pics/a.png"><img id="f" src="diagram.svg">');
    rewriteLinks(root, 'file:///home/u/proj/readme.md');
    expect(root.querySelector('#rel').getAttribute('src')).toBe('file:///home/u/proj/pics/a.png');
    expect(root.querySelector('#f').getAttribute('src')).toBe('file:///home/u/proj/diagram.svg');
  });
});

describe('rewriteLinks — relative documents', () => {
  it('resolves a relative viewer file against baseUrl and intercepts clicks', () => {
    const onOpen = vi.fn();
    const root = build('<a href="docs/readme.md">doc</a>');
    rewriteLinks(root, 'https://x.com/proj/', onOpen);
    const a = root.querySelector('a');
    expect(a.getAttribute('href')).toBe('https://x.com/proj/docs/readme.md');

    const event = click(a);
    expect(event.defaultPrevented).toBe(true);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(onOpen.mock.calls[0][0]).toMatchObject({
      url: 'https://x.com/proj/docs/readme.md',
      kind: 'resolved-relative-document'
    });
  });

  it('keeps supported document links as normal navigation in inline mode', () => {
    const onOpen = vi.fn();
    const root = build('<a href="docs/readme.md">doc</a>');
    rewriteLinks(root, 'https://x.com/proj/', onOpen, {
      supportedDocumentBehavior: 'navigate'
    });
    const a = root.querySelector('a');

    expect(a.getAttribute('href')).toBe('https://x.com/proj/docs/readme.md');
    expect(a.hasAttribute('target')).toBe(false);
    expect(onOpen).not.toHaveBeenCalled();
  });

  it('without baseUrl, intercepts supported relative docs without rewriting href', () => {
    const onOpen = vi.fn();
    const root = build('<a href="other.md">rel</a>');
    rewriteLinks(root, '', onOpen);
    const a = root.querySelector('a');
    expect(a.getAttribute('href')).toBe('other.md');

    const event = click(a);
    expect(event.defaultPrevented).toBe(true);
    expect(onOpen).toHaveBeenCalledWith({ href: 'other.md', kind: 'relative-document' });
  });

  it('without baseUrl, removes href of unsupported relative targets', () => {
    const root = build('<a href="payload.bin">x</a>');
    rewriteLinks(root, '');
    expect(root.querySelector('a').hasAttribute('href')).toBe(false);
  });
});
