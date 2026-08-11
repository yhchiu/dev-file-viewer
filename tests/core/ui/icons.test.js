import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as icons from '../../../src/core/ui/icons.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

function readPublic(relativePath) {
  return readFileSync(path.join(root, 'public', relativePath), 'utf8');
}

const iconHelpers = Object.entries(icons).filter(([name]) => name.startsWith('get'));

describe('icon helpers', () => {
  it('exposes every icon through a helper', () => {
    expect(iconHelpers).toHaveLength(icons.ICON_IDS.length);
  });

  // The content script draws these icons into file:// pages, where an external
  // <use> reference is blocked because file: URLs are unique origins.
  it('returns self-contained markup with no external reference', () => {
    for (const [name, getIcon] of iconHelpers) {
      const markup = getIcon('demo-icon');
      expect(markup, name).toMatch(/^<svg class="demo-icon" viewBox="[\d .]+"/);
      expect(markup, name).not.toContain('sprite.svg');
      expect(markup, name).not.toContain('<use');
      expect(markup, name).toMatch(/<(path|rect|circle|polyline)\b/);
    }
  });

  it('defaults to an empty class list', () => {
    expect(icons.getCopyIcon()).toContain('class=""');
  });
});

describe('icon sprite', () => {
  const sprite = readPublic('assets/icons/sprite.svg');
  const spriteIds = [...sprite.matchAll(/<symbol id="([^"]+)"/g)].map(match => match[1]);

  it('defines every symbol the extension pages reference', () => {
    const pages = ['viewer/index.html', 'settings/index.html', 'popup/index.html'];
    const referenced = new Set();

    for (const page of pages) {
      for (const match of readPublic(page).matchAll(/sprite\.svg#([\w-]+)/g)) {
        referenced.add(match[1]);
      }
    }

    // Set by app.js when the Markdown source/preview toggle changes state.
    referenced.add('code');
    referenced.add('eye');

    expect(referenced.size).toBeGreaterThan(0);
    expect([...referenced].filter(id => !spriteIds.includes(id))).toEqual([]);
  });

  it('does not repeat icons that the JavaScript helpers already own', () => {
    const shared = spriteIds.filter(id => icons.ICON_IDS.includes(id));
    expect(shared).toEqual(['arrow-right']);
  });
});
