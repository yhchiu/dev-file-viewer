import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// jsdom has no layout engine, so the split-view layout rules are asserted on the
// stylesheets themselves. Split columns have a fixed width: without wrapping,
// long lines overflow the cell and paint over the opposite side of the diff.
const publicDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'public');

const readCss = relativePath => readFileSync(join(publicDir, relativePath), 'utf8');

const ruleBody = (css, selector) => {
  const start = css.indexOf(`${selector} {`);
  expect(start, `missing rule: ${selector}`).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf('}', start));
};

describe('split diff stylesheets', () => {
  it.each([
    ['viewer/viewer.css', '.diff-table-split .diff-code'],
    ['viewer/viewer.css', '.markdown-body.diff-body .diff-table-split .diff-code'],
    ['content/inline-preview.css', '[data-dfv-inline-root] .diff-table-split .diff-code']
  ])('wraps long code lines: %s (%s)', (file, selector) => {
    const body = ruleBody(readCss(file), selector);

    expect(body).toContain('white-space: pre-wrap');
    expect(body).toContain('overflow-wrap: anywhere');
  });

  it('limits the Markdown zebra reset to the unified table', () => {
    const css = readCss('viewer/viewer.css');

    // Split rows colour each side per cell, so `background: inherit` would strip
    // the added/removed colour from every even row.
    expect(css).toContain('.diff-table-unified tr:nth-child(even) td');
    expect(css).not.toContain('.diff-table tr:nth-child(even) td');
  });
});
