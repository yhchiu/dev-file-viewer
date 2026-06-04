import { describe, it, expect, vi, afterEach } from 'vitest';
// jsdom's File lacks text(); use Node's spec-complete File.
import { File } from 'node:buffer';
import { DirectorySourceProvider } from '../../../src/core/sources/DirectorySourceProvider.js';
import { UrlSourceProvider } from '../../../src/core/sources/UrlSourceProvider.js';
import { FilePickerSourceProvider } from '../../../src/core/sources/FilePickerSourceProvider.js';

describe('DirectorySourceProvider.resolveRelativePath', () => {
  const p = new DirectorySourceProvider();

  it('resolves a sibling path', () => {
    expect(p.resolveRelativePath('docs/a.md', 'b.md')).toBe('docs/b.md');
  });

  it('handles ./ and ../ segments', () => {
    expect(p.resolveRelativePath('docs/a.md', './c.md')).toBe('docs/c.md');
    expect(p.resolveRelativePath('docs/sub/a.md', '../e.md')).toBe('docs/e.md');
  });

  it('treats a leading slash as folder-root relative', () => {
    expect(p.resolveRelativePath('docs/sub/a.md', '/abs.md')).toBe('abs.md');
  });

  it('normalises backslashes and strips query/hash', () => {
    expect(p.resolveRelativePath('a.md', 'sub\\f.md')).toBe('sub/f.md');
    expect(p.resolveRelativePath('docs/a.md', 'b.md?x=1#y')).toBe('docs/b.md');
  });

  it('cannot escape the folder root (path not in index → loadPath throws)', async () => {
    const escaped = p.resolveRelativePath('a.md', '../../etc/passwd');
    expect(escaped).toBe('etc/passwd');
    await expect(p.loadPath(escaped)).rejects.toThrow(/not found/i);
  });
});

describe('UrlSourceProvider.load', () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubFetch(impl) {
    vi.stubGlobal('fetch', vi.fn(impl));
  }

  it('loads markdown and sets baseUrl to the url', async () => {
    stubFetch(async () => ({ ok: true, headers: { get: () => 'text/markdown' }, text: async () => '# hi' }));
    const doc = await new UrlSourceProvider().load('https://x.com/readme.md');
    expect(doc.format).toBe('markdown');
    expect(doc.baseUrl).toBe('https://x.com/readme.md');
    expect(doc.text).toBe('# hi');
  });

  it('throws on non-ok responses', async () => {
    stubFetch(async () => ({ ok: false, status: 404, headers: { get: () => '' }, text: async () => '' }));
    await expect(new UrlSourceProvider().load('https://x.com/missing.md')).rejects.toThrow(/HTTP 404/);
  });

  it('classifies raw HTML source as source-code/html', async () => {
    stubFetch(async () => ({
      ok: true,
      headers: { get: () => 'text/html' },
      text: async () => '<!doctype html><html><body>hi</body></html>'
    }));
    const doc = await new UrlSourceProvider().load('https://x.com/page.html');
    expect(doc.format).toBe('source-code');
    expect(doc.language).toBe('html');
  });

  it('throws when url is missing', async () => {
    await expect(new UrlSourceProvider().load('')).rejects.toThrow(/Missing URL/);
  });
});

describe('FilePickerSourceProvider.loadFromFile', () => {
  it('reads a File into a document descriptor', async () => {
    const file = new File(['# hi'], 'readme.md', { type: 'text/markdown' });
    const doc = await new FilePickerSourceProvider().loadFromFile(file);
    expect(doc).toMatchObject({ name: 'readme.md', format: 'markdown', sourceType: 'file', baseUrl: '' });
    expect(doc.text).toBe('# hi');
  });
});

describe('FilePickerSourceProvider.pickFile', () => {
  afterEach(() => {
    delete window.showOpenFilePicker;
  });

  it('notifies when a selected file starts loading', async () => {
    const calls = [];
    const file = new File(['# hi'], 'readme.md', { type: 'text/markdown' });
    const handle = {
      name: 'readme.md',
      getFile: vi.fn(async () => {
        calls.push('getFile');
        return file;
      })
    };
    window.showOpenFilePicker = vi.fn(async () => {
      calls.push('picker');
      return [handle];
    });

    const doc = await new FilePickerSourceProvider().pickFile({
      onLoadStart: name => calls.push(`load:${name}`)
    });

    expect(doc.name).toBe('readme.md');
    expect(calls).toEqual(['picker', 'load:readme.md', 'getFile']);
  });
});

// Minimal fakes for the File System Access API (showDirectoryPicker handles).
function fileHandle(name, parts = [`// ${name}`]) {
  return { kind: 'file', name, getFile: async () => new File(parts, name) };
}
function dirHandle(name, entries) {
  return {
    kind: 'directory',
    name,
    entries: async function* () {
      for (const pair of entries) yield pair;
    }
  };
}

describe('DirectorySourceProvider.loadDirectoryHandle / buildTree', () => {
  function sampleRoot() {
    return dirHandle('proj', [
      ['.hidden', dirHandle('.hidden', [])],
      ['src', dirHandle('src', [
        ['a.js', fileHandle('a.js')],
        ['notes.txt', fileHandle('notes.txt')]
      ])],
      ['README.md', fileHandle('README.md')],
      ['image.png', fileHandle('image.png', [new Uint8Array([137, 80, 78, 71, 0, 1])])]
    ]);
  }

  it('builds a sorted tree with every visible file', async () => {
    const provider = new DirectorySourceProvider();
    const { tree } = await provider.loadDirectoryHandle(sampleRoot());
    expect(tree.type).toBe('directory');
    expect(tree.name).toBe('proj');
    expect(tree.children.map(c => c.name)).toEqual(['src', 'image.png', 'README.md']);
    const src = tree.children.find(c => c.name === 'src');
    expect(src.children.map(c => c.name)).toEqual(['a.js', 'notes.txt']);
  });

  it('indexes files so loadPath reads content via the handle', async () => {
    const provider = new DirectorySourceProvider();
    await provider.loadDirectoryHandle(sampleRoot());
    const { doc, node } = await provider.loadPath('src/a.js');
    expect(node.path).toBe('src/a.js');
    expect(doc).toMatchObject({ name: 'a.js', sourceType: 'directory-file', path: 'src/a.js', baseUrl: '' });
    expect(doc.text).toContain('a.js');
    const { doc: unsupportedTextDoc } = await provider.loadPath('src/notes.txt');
    expect(unsupportedTextDoc).toMatchObject({ name: 'notes.txt', sourceType: 'directory-file', path: 'src/notes.txt' });
    expect(unsupportedTextDoc.text).toContain('notes.txt');
    await expect(provider.loadPath('missing/x.js')).rejects.toThrow(/not found/i);
  });

  it('rejects binary files from the visible tree before reading them as text', async () => {
    const provider = new DirectorySourceProvider();
    await provider.loadDirectoryHandle(sampleRoot());

    await expect(provider.loadPath('image.png')).rejects.toMatchObject({
      code: 'BINARY_FILE',
      fileName: 'image.png'
    });
  });

  it('reloadDirectory rebuilds from the stored root handle', async () => {
    const provider = new DirectorySourceProvider();
    await provider.loadDirectoryHandle(sampleRoot());
    const { tree } = await provider.reloadDirectory();
    expect(tree.children.map(c => c.name)).toEqual(['src', 'image.png', 'README.md']);
  });

  it('reloadDirectory throws when nothing is open', async () => {
    await expect(new DirectorySourceProvider().reloadDirectory()).rejects.toThrow(/No folder/i);
  });
});

describe('DirectorySourceProvider.pickDirectory', () => {
  afterEach(() => {
    delete window.showDirectoryPicker;
  });

  it('notifies when a selected folder starts loading', async () => {
    const calls = [];
    const root = dirHandle('proj', [
      ['README.md', fileHandle('README.md')]
    ]);
    const originalEntries = root.entries;
    root.entries = async function* () {
      calls.push('entries');
      yield* originalEntries.call(root);
    };
    window.showDirectoryPicker = vi.fn(async () => {
      calls.push('picker');
      return root;
    });

    const { tree } = await new DirectorySourceProvider().pickDirectory({
      onLoadStart: name => calls.push(`load:${name}`)
    });

    expect(tree.name).toBe('proj');
    expect(calls).toEqual(['picker', 'load:proj', 'entries']);
  });
});

// Minimal fakes for the legacy webkit directory-entry API.
function fileEntry(name, parts = [`// ${name}`]) {
  return { isFile: true, isDirectory: false, name, file: cb => cb(new File(parts, name)) };
}
function dirEntry(name, children) {
  return {
    isDirectory: true,
    isFile: false,
    name,
    createReader: () => {
      let served = false;
      return { readEntries: ok => { if (served) return ok([]); served = true; ok(children); } };
    }
  };
}

describe('DirectorySourceProvider.loadDirectoryEntry / buildEntryTree', () => {
  it('builds and indexes a tree from directory entries', async () => {
    const provider = new DirectorySourceProvider();
    const root = dirEntry('proj', [
      dirEntry('.git', [fileEntry('config')]),
      dirEntry('lib', [fileEntry('m.py'), fileEntry('skip.bin', [new Uint8Array([0, 1, 2, 3])])]),
      fileEntry('guide.md')
    ]);
    const { tree } = await provider.loadDirectoryEntry(root);
    expect(tree.children.map(c => c.name)).toEqual(['lib', 'guide.md']);
    expect(tree.children.find(c => c.name === 'lib').children.map(c => c.name)).toEqual(['m.py', 'skip.bin']);

    const { doc } = await provider.loadPath('lib/m.py');
    expect(doc.text).toContain('m.py');
    await expect(provider.loadPath('lib/skip.bin')).rejects.toMatchObject({
      code: 'BINARY_FILE',
      fileName: 'skip.bin'
    });
  });
});
