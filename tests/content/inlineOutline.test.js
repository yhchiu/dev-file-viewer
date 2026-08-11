import { describe, expect, it } from 'vitest';
import {
  buildDiffOutlineEntries,
  buildMarkdownOutlineEntries,
  buildSourceOutlineEntries
} from '../../src/content/inlineOutline.js';
import { SourceCodeRenderer } from '../../src/core/source/SourceCodeRenderer.js';

function createPreview(html = '') {
  const preview = document.createElement('main');
  preview.innerHTML = html;
  return preview;
}

describe('buildMarkdownOutlineEntries', () => {
  it('maps headings to entries that keep their level and element', () => {
    const preview = createPreview(
      '<h1 id="intro">Intro</h1><h2 id="install">Install</h2><h3 id="windows">Windows</h3>'
    );

    const entries = buildMarkdownOutlineEntries(preview);

    expect(entries.map(entry => [entry.kind, entry.text, entry.level, entry.anchorId])).toEqual([
      ['heading', 'Intro', 1, 'intro'],
      ['heading', 'Install', 2, 'install'],
      ['heading', 'Windows', 3, 'windows']
    ]);
    expect(entries[0].element).toBe(preview.querySelector('#intro'));
    expect(entries.every(entry => !entry.badge && !entry.meta)).toBe(true);
  });

  it('returns nothing without a preview or headings', () => {
    expect(buildMarkdownOutlineEntries(null)).toEqual([]);
    expect(buildMarkdownOutlineEntries(createPreview('<p>Text</p>'))).toEqual([]);
  });
});

describe('buildDiffOutlineEntries', () => {
  const files = [
    {
      id: 'diff-file-0-src-core-a-js',
      path: 'src/core/a.js',
      stats: { added: 12, removed: 3 },
      element: document.createElement('section')
    },
    {
      id: 'diff-file-1-readme-md',
      path: 'README.md',
      stats: { added: 1, removed: 0 },
      element: document.createElement('section')
    }
  ];

  it('flattens the directory tree into indented rows', () => {
    const entries = buildDiffOutlineEntries(files);

    expect(entries.map(entry => [entry.kind, entry.text, entry.level])).toEqual([
      ['diff-directory', 'src/core', 1],
      ['diff-file', 'a.js', 2],
      ['diff-file', 'README.md', 1]
    ]);
  });

  it('gives files their stats, anchor and element, and directories none', () => {
    const [directory, file] = buildDiffOutlineEntries(files);

    expect(directory.element).toBeNull();
    expect(directory.anchorId).toBe('');
    expect(file.element).toBe(files[0].element);
    expect(file.anchorId).toBe('diff-file-0-src-core-a-js');
    expect(file.meta).toBe('+12 −3');
    expect(file.title).toBe('src/core/a.js');
  });

  it('returns nothing for a diff without files', () => {
    expect(buildDiffOutlineEntries([])).toEqual([]);
  });
});

describe('buildSourceOutlineEntries', () => {
  const source = [
    'export class Widget {',
    '  render() {',
    '    return null;',
    '  }',
    '}',
    '',
    'function helper() {}'
  ].join('\n');

  function renderSource(text, language) {
    const preview = createPreview();
    new SourceCodeRenderer().render(text, preview, { language });
    return preview;
  }

  it('maps symbols to badged entries that nest by level', () => {
    const preview = renderSource(source, 'javascript');

    const entries = buildSourceOutlineEntries(source, 'javascript', preview);

    expect(entries.map(entry => [entry.text, entry.level, entry.meta])).toEqual([
      ['Widget', 1, 'L1'],
      ['render', 2, 'L2'],
      ['helper', 1, 'L7']
    ]);
    expect(entries[0].kind).toBe('source-symbol');
    expect(entries[0].badge).toBe('class');
    expect(entries[1].badge).toBe('meth');
    expect(entries[0].anchorId).toBe('L1');
    expect(entries[0].element).toBe(preview.querySelector('#L1'));
  });

  it('returns nothing for languages without a symbol extractor', () => {
    const text = 'body { color: red; }';
    expect(buildSourceOutlineEntries(text, 'css', renderSource(text, 'css'))).toEqual([]);
    expect(buildSourceOutlineEntries(source, 'javascript', null)).toEqual([]);
  });
});
