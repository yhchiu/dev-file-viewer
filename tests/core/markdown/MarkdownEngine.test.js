import { describe, it, expect, beforeEach } from 'vitest';
import { MarkdownEngine } from '../../../src/core/markdown/MarkdownEngine.js';
import { buildHeadingIndex, ensureHeadingAnchors } from '../../../src/core/toc/headingIndex.js';

const noopPlugins = { runAfterRender: async () => {} };

function newTarget() {
  const el = document.createElement('article');
  document.body.append(el);
  return el;
}

describe('MarkdownEngine — XSS sanitisation', () => {
  let engine;
  let target;

  beforeEach(() => {
    engine = new MarkdownEngine(noopPlugins);
    target = newTarget();
  });

  it('strips <script> tags', async () => {
    await engine.render('intro\n\n<script>window.__x = 1</script>', target);
    expect(target.querySelector('script')).toBeNull();
    expect(target.innerHTML).not.toContain('window.__x');
  });

  it('strips event-handler attributes (onerror/onload)', async () => {
    await engine.render(
      '<img src="x" onerror="alert(1)">\n\n<svg onload="alert(1)"></svg>',
      target
    );
    expect(target.innerHTML.toLowerCase()).not.toContain('onerror');
    expect(target.innerHTML.toLowerCase()).not.toContain('onload');
  });

  it('neutralises javascript: links (markdown + raw html)', async () => {
    await engine.render(
      '[click](javascript:alert(1))\n\n<a href="javascript:alert(2)">raw</a>',
      target
    );
    expect(target.innerHTML.toLowerCase()).not.toContain('javascript:');
  });

  it('removes <iframe> embeds', async () => {
    await engine.render('<iframe src="https://evil.example"></iframe>', target);
    expect(target.querySelector('iframe')).toBeNull();
  });

  it('strips external url() from inline styles (privacy beacon)', async () => {
    await engine.render(
      '<div style="background: url(http://evil.example/x.png); color: red">hi</div>',
      target
    );
    expect(target.innerHTML.toLowerCase()).not.toContain('url(');
    expect(target.innerHTML.toLowerCase()).not.toContain('evil.example');
  });

  it('drops <foreignObject> (mutation-XSS surface)', async () => {
    await engine.render('<svg><foreignObject><div>x</div></foreignObject></svg>', target);
    expect(target.querySelector('foreignObject')).toBeNull();
  });

  it('namespaces user ids to prevent DOM clobbering', async () => {
    await engine.render('<div id="status">x</div>', target);
    expect(target.innerHTML).toContain('user-content-status');
    expect(target.querySelector('[id="status"]')).toBeNull();
  });
});

describe('MarkdownEngine — normal rendering', () => {
  let engine;
  let target;

  beforeEach(() => {
    engine = new MarkdownEngine(noopPlugins);
    target = newTarget();
  });

  it('renders headings, emphasis and lists', async () => {
    await engine.render('# Title\n\n**bold** text\n\n- one\n- two', target);
    expect(target.querySelector('h1')?.textContent).toBe('Title');
    expect(target.querySelector('strong')?.textContent).toBe('bold');
    expect(target.querySelectorAll('ul > li')).toHaveLength(2);
  });

  it('highlights fenced code and installs a copy button', async () => {
    await engine.render('```js\nconst x = 1;\n```', target);
    const code = target.querySelector('pre > code');
    expect(code).not.toBeNull();
    expect(code.classList.contains('hljs')).toBe(true);
    expect(target.querySelector('.markdown-code-toolbar .markdown-code-copy')).not.toBeNull();
  });

  it('resolves relative image sources against baseUrl', async () => {
    await engine.render('![alt](img/x.png)', target, { baseUrl: 'https://x.com/d/' });
    expect(target.querySelector('img')?.getAttribute('src')).toBe('https://x.com/d/img/x.png');
  });
});

describe('MarkdownEngine — YAML front matter', () => {
  let engine;
  let target;

  beforeEach(() => {
    engine = new MarkdownEngine(noopPlugins);
    target = newTarget();
  });

  it('strips the YAML block and shows a display-only metadata card', async () => {
    await engine.render(
      '---\ntitle: Hello\ntags: [a, b]\n---\n\n# Body\n\nSee http://example.com',
      target
    );

    expect(target.querySelector('hr')).toBeNull();
    expect(target.textContent).not.toMatch(/^title:/m);
    expect(target.querySelector('h1')?.textContent).toBe('Body');
    const table = target.querySelector('table[data-front-matter]');
    expect(table).not.toBeNull();
    expect(table.querySelector('thead')?.getAttribute('aria-hidden')).toBe('true');
    expect([...table.querySelectorAll('thead th')].every(node => !node.textContent.trim())).toBe(
      true
    );
    expect([...table.querySelectorAll('tbody td')].map(node => node.textContent)).toEqual([
      'title',
      'Hello',
      'tags',
      'a, b'
    ]);
    expect(table.querySelector('h1, h2, caption')).toBeNull();
    ensureHeadingAnchors(target);
    expect(buildHeadingIndex(target).map(heading => heading.text)).toEqual(['Body']);
  });

  it('keeps front-matter values as literal table text', async () => {
    await engine.render(
      '---\ntitle: Hello *world*\nurl: https://example.com/a|b\n---\n\n# Body',
      target
    );
    const table = target.querySelector('table[data-front-matter]');
    expect(table.querySelector('em, a, img')).toBeNull();
    expect(table.textContent).toContain('Hello *world*');
    expect(table.textContent).toContain('https://example.com/a|b');
  });

  it('does not interpret front-matter values as HTML', async () => {
    await engine.render('---\ntitle: <img src="x" onerror="alert(1)">\n---\n\n# Body', target);
    const table = target.querySelector('table[data-front-matter]');
    expect(table?.textContent).toContain('<img src="x" onerror="alert(1)">');
    expect(table?.querySelector('img')).toBeNull();
    expect(target.querySelector('img[onerror], img[src="x"]')).toBeNull();
  });

  it('still strips a broken YAML block and shows the raw inner text', async () => {
    await engine.render('---\ntitle: A\ntitle: B\n---\n\n# Body', target);
    expect(target.querySelector('hr')).toBeNull();
    expect(target.querySelector('h1')?.textContent).toBe('Body');
    expect(target.querySelector('pre[data-front-matter-raw]')?.textContent).toContain('title: A');
  });

  it('leaves a leading thematic break alone when it is not front matter', async () => {
    await engine.render('---\n\n# Body', target);
    expect(target.querySelector('[data-front-matter]')).toBeNull();
    expect(target.querySelector('hr')).not.toBeNull();
    expect(target.querySelector('h1')?.textContent).toBe('Body');
  });
});
