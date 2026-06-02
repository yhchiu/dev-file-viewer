import { describe, it, expect } from 'vitest';
import {
  getFileName,
  getExtension,
  isSupportedDocumentFile,
  isSupportedDiffFile,
  isSupportedSourceCodeFile,
  isSupportedViewerFile,
  sourceLanguageFromPath,
  formatLabel,
  detectFormat,
  displayNameFromUrl,
  FORMAT_IDS
} from '../../../src/core/format/fileTypes.js';

describe('getFileName / getExtension', () => {
  it('extracts file name from paths and urls (strips query/hash)', () => {
    expect(getFileName('/a/b/c.md')).toBe('c.md');
    expect(getFileName('C:\\a\\b\\c.md')).toBe('c.md');
    expect(getFileName('https://x.com/d/readme.md?x=1#y')).toBe('readme.md');
  });

  it('lower-cases extension and handles dotfiles / no extension', () => {
    expect(getExtension('README.MD')).toBe('.md');
    expect(getExtension('Makefile')).toBe('');
    expect(getExtension('.gitignore')).toBe(''); // dotIndex 0 → no extension
    expect(getExtension('archive.tar.gz')).toBe('.gz');
  });
});

describe('isSupported* predicates', () => {
  it('classifies documents, diffs and source files', () => {
    expect(isSupportedDocumentFile('a.md')).toBe(true);
    expect(isSupportedDiffFile('a.patch')).toBe(true);
    expect(isSupportedSourceCodeFile('a.ts')).toBe(true);
    expect(isSupportedSourceCodeFile('image.png')).toBe(false);
  });

  it('recognises special filenames without extensions', () => {
    expect(isSupportedSourceCodeFile('Dockerfile')).toBe(true);
    expect(isSupportedSourceCodeFile('Makefile')).toBe(true);
    expect(isSupportedSourceCodeFile('CMakeLists.txt')).toBe(true);
  });

  it('isSupportedViewerFile is the union', () => {
    expect(isSupportedViewerFile('a.md')).toBe(true);
    expect(isSupportedViewerFile('a.diff')).toBe(true);
    expect(isSupportedViewerFile('a.rs')).toBe(true);
    expect(isSupportedViewerFile('a.exe')).toBe(false);
  });
});

describe('sourceLanguageFromPath', () => {
  it('maps extensions and special names, defaulting to plaintext', () => {
    expect(sourceLanguageFromPath('a.ts')).toBe('typescript');
    expect(sourceLanguageFromPath('a.py')).toBe('python');
    expect(sourceLanguageFromPath('Dockerfile')).toBe('dockerfile');
    expect(sourceLanguageFromPath('mystery.unknown')).toBe('plaintext');
  });
});

describe('detectFormat', () => {
  it('prefers name/extension then falls back to mime type', () => {
    expect(detectFormat({ name: 'a.md' })).toBe(FORMAT_IDS.MARKDOWN);
    expect(detectFormat({ name: 'a.patch' })).toBe(FORMAT_IDS.DIFF);
    expect(detectFormat({ name: 'a.ts' })).toBe(FORMAT_IDS.SOURCE_CODE);
    expect(detectFormat({ mimeType: 'text/markdown' })).toBe(FORMAT_IDS.MARKDOWN);
    expect(detectFormat({ mimeType: 'application/json' })).toBe(FORMAT_IDS.SOURCE_CODE);
    expect(detectFormat({ name: 'mystery.bin' })).toBe(FORMAT_IDS.UNKNOWN);
  });
});

describe('formatLabel / displayNameFromUrl', () => {
  it('labels formats', () => {
    expect(formatLabel(FORMAT_IDS.MARKDOWN)).toBe('Markdown');
    expect(formatLabel(FORMAT_IDS.DIFF)).toBe('Diff');
    expect(formatLabel('something-else')).toBe('Unknown');
  });

  it('derives a display name from urls and paths', () => {
    expect(displayNameFromUrl('https://x.com/docs/readme.md')).toBe('readme.md');
    expect(displayNameFromUrl('https://x.com/')).toBe('x.com');
    expect(displayNameFromUrl('/local/path/file.txt')).toBe('file.txt');
  });
});
