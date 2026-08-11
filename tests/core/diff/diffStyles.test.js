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

const declaration = (body, property) => {
  const match = body.match(new RegExp(`${property}:\\s*([^;]+);`));
  expect(match, `missing declaration: ${property}`).not.toBeNull();
  return match[1].trim();
};

// The two stylesheets name the same colour through differently prefixed
// variables, so compare declarations with the prefix and layout removed.
const normalize = value => value.replace(/\s+/g, '').replace(/--dfv-/g, '--');

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

// The inline preview renders the same diff markup as the viewer, so its styling
// must follow the viewer's. The viewer is the reference for every value below.
describe('inline preview diff styles follow the viewer', () => {
  const viewerCss = readCss('viewer/viewer.css');
  const inlineCss = readCss('content/inline-preview.css');

  it('uses the viewer filler colour for empty split cells', () => {
    const light = declaration(
      ruleBody(viewerCss, '.markdown-body.diff-body .diff-table-split .diff-split-empty'),
      'background'
    );
    const dark = declaration(
      ruleBody(
        viewerCss,
        ":root[data-theme='dark'] .markdown-body.diff-body .diff-table-split .diff-split-empty"
      ),
      'background'
    );

    expect(
      declaration(ruleBody(inlineCss, '[data-dfv-inline-root]'), '--dfv-diff-split-empty')
    ).toBe(light);
    expect(
      declaration(
        ruleBody(inlineCss, "[data-dfv-inline-root][data-dfv-theme='dark']"),
        '--dfv-diff-split-empty'
      )
    ).toBe(dark);
  });

  it('raises the active view-toggle button like the viewer', () => {
    const light = declaration(
      ruleBody(viewerCss, '.diff-view-toggle-button.is-active'),
      'box-shadow'
    );
    const dark = declaration(
      ruleBody(viewerCss, ":root[data-theme='dark'] .diff-view-toggle-button.is-active"),
      'box-shadow'
    );

    expect(
      declaration(
        ruleBody(inlineCss, '[data-dfv-inline-root] .diff-view-toggle-button.is-active'),
        'box-shadow'
      )
    ).toBe(light);
    expect(
      declaration(
        ruleBody(
          inlineCss,
          "[data-dfv-inline-root][data-dfv-theme='dark'] .diff-view-toggle-button.is-active"
        ),
        'box-shadow'
      )
    ).toBe(dark);
  });

  it('washes the file header with the same accent gradient', () => {
    const viewer = declaration(ruleBody(viewerCss, '.diff-file-header'), 'background');
    const inline = declaration(
      ruleBody(inlineCss, '[data-dfv-inline-root] .diff-file-header'),
      'background'
    );

    expect(normalize(inline)).toBe(normalize(viewer));
  });

  it('draws the file title icon like the viewer', () => {
    const viewer = ruleBody(viewerCss, '.diff-file-title::before');
    const inline = ruleBody(inlineCss, '[data-dfv-inline-root] .diff-file-title::before');

    for (const property of ['width', 'height', 'border', 'border-radius', 'background']) {
      expect(normalize(declaration(inline, property)), property).toBe(
        normalize(declaration(viewer, property))
      );
    }
    expect(
      declaration(ruleBody(inlineCss, '[data-dfv-inline-root] .diff-file-title'), 'padding-left')
    ).toBe('28px');
  });

  it('gives the file card the viewer shadow', () => {
    expect(
      declaration(ruleBody(inlineCss, '[data-dfv-inline-root] .diff-file'), 'box-shadow')
    ).toBe(declaration(ruleBody(viewerCss, '.diff-file'), 'box-shadow'));
  });

  it('keeps the meta line flush inside the file card', () => {
    // .diff-meta is a <pre>: in the inline preview the code-block styling
    // outranks the .diff-meta rule and adds a 1em margin, so the reset needs the
    // preview ancestor to win.
    expect(declaration(ruleBody(viewerCss, '.diff-meta'), 'margin')).toBe('0');
    expect(
      declaration(
        ruleBody(inlineCss, '[data-dfv-inline-root] .dfv-inline-preview .diff-meta'),
        'margin'
      )
    ).toBe('0');
  });
});

// The inline preview mirrors the viewer's reading themes with its own --dfv-*
// tokens. The diff chrome reads those tokens, so drift here shows up as a
// mismatched file header, meta line and hunk header even when the rules agree.
describe('inline preview palette follows the viewer themes', () => {
  const themesCss = readCss('viewer/viewer-themes.css');
  const inlineCss = readCss('content/inline-preview.css');

  const TOKENS = [
    'bg',
    'panel',
    'panel-2',
    'fg',
    'muted',
    'line',
    'accent',
    'accent-soft',
    'code-bg'
  ];

  const THEMES = [
    ['bloom', ":root[data-app-theme='bloom']", '[data-dfv-inline-root]'],
    ['forge', ":root[data-app-theme='forge']", "[data-dfv-inline-root][data-dfv-theme='dark']"],
    ['folio', ":root[data-app-theme='folio']", "[data-dfv-inline-root][data-dfv-app-theme='folio']"]
  ];

  it.each(THEMES)('matches the %s palette', (_theme, viewerSelector, inlineSelector) => {
    const viewer = ruleBody(themesCss, viewerSelector);
    const inline = ruleBody(inlineCss, inlineSelector);

    for (const token of TOKENS) {
      expect(declaration(inline, `--dfv-${token}`), token).toBe(declaration(viewer, `--${token}`));
    }
  });

  it.each(THEMES)(
    'grounds content on the %s reading pane colour',
    (_theme, viewerSelector, inlineSelector) => {
      // The diff file cards sit straight on this colour, so it shows between them.
      const pane = declaration(ruleBody(themesCss, `${viewerSelector} .viewer-main`), 'background');
      const surface = declaration(ruleBody(inlineCss, inlineSelector), '--dfv-surface');

      expect(normalize(surface)).toBe(normalize(pane));
    }
  );
});
