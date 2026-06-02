import { describe, it, expect } from 'vitest';
import {
  buildHeadingTree,
  buildHeadingIndex,
  ensureHeadingAnchors,
  slugify,
  normalizeHeadingText,
  getHeadingLevel
} from '../../../src/core/toc/headingIndex.js';

describe('buildHeadingTree', () => {
  it('nests headings by level and records parent/children relationships', () => {
    const tree = buildHeadingTree([
      { id: 'a', text: 'A', level: 1 },
      { id: 'b', text: 'B', level: 2 },
      { id: 'c', text: 'C', level: 2 },
      { id: 'd', text: 'D', level: 1 }
    ]);
    expect(tree.roots.map(n => n.id)).toEqual(['a', 'd']);
    const a = tree.byId.get('a');
    expect(a.hasChildren).toBe(true);
    expect(a.childIds).toEqual(['b', 'c']);
    expect(tree.byId.get('b').parentIds).toEqual(['a']);
    expect(tree.byId.get('d').hasChildren).toBe(false);
  });
});

describe('ensureHeadingAnchors', () => {
  it('assigns slug ids and de-duplicates collisions', () => {
    const root = document.createElement('div');
    root.innerHTML = '<h2>Hello World</h2><h2>Hello World</h2><h3 id="kept">Kept</h3>';
    ensureHeadingAnchors(root);
    const [h1, h2, h3] = root.querySelectorAll('h2, h3');
    expect(h1.id).toBe('hello-world');
    expect(h2.id).toBe('hello-world-1');
    expect(h3.id).toBe('kept');
  });
});

describe('buildHeadingIndex', () => {
  it('collects headings up to maxLevel only', () => {
    const root = document.createElement('div');
    root.innerHTML = '<h1 id="x">X</h1><h2 id="y">Y</h2><h4 id="z">Z</h4>';
    const headings = buildHeadingIndex(root, { maxLevel: 3 });
    expect(headings.map(h => h.id)).toEqual(['x', 'y']);
    expect(headings[0].level).toBe(1);
  });
});

describe('text helpers', () => {
  it('slugify normalises diacritics and punctuation', () => {
    expect(slugify('Héllo, World!')).toBe('hello-world');
  });

  it('normalizeHeadingText collapses whitespace', () => {
    expect(normalizeHeadingText('  a   b\n c ')).toBe('a b c');
  });

  it('getHeadingLevel reads the tag number', () => {
    const h3 = document.createElement('h3');
    expect(getHeadingLevel(h3)).toBe(3);
  });
});
