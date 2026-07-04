import { describe, it, expect } from 'vitest';
import {
  getFileName,
  getExtension,
  getRecognizedExtension,
  isSupportedDocumentFile,
  isSupportedDiffFile,
  isSupportedTextFile,
  isSupportedSourceCodeFile,
  isSupportedViewerFile,
  isConfigDotfile,
  ALL_SUPPORTED_EXTENSIONS,
  sourceLanguageFromPath,
  formatLabel,
  detectFormat,
  detectLineEnding,
  lineEndingLabel,
  displayNameFromUrl,
  matchedAutoOpenKey,
  AUTO_OPEN_CATEGORIES,
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

  it('recognises inner extensions before common example/default suffixes', () => {
    expect(getExtension('config.yaml.example')).toBe('.example');
    expect(getRecognizedExtension('config.yaml.example')).toBe('.yaml');
    expect(getRecognizedExtension('config.ini.default')).toBe('.ini');
    expect(getRecognizedExtension('config.json.sample')).toBe('.json');
    expect(getRecognizedExtension('phpunit.xml.dist')).toBe('.xml');
    expect(getRecognizedExtension('settings.toml.template')).toBe('.toml');
    expect(getRecognizedExtension('https://x.test/config.YML.DEFAULT?raw=1')).toBe('.yml');
    expect(getRecognizedExtension('notes.example')).toBe('.example');
  });
});

describe('isSupported* predicates', () => {
  it('classifies documents, diffs and source files', () => {
    expect(isSupportedDocumentFile('a.md')).toBe(true);
    expect(isSupportedDiffFile('a.patch')).toBe(true);
    expect(isSupportedTextFile('notes.txt')).toBe(true);
    expect(isSupportedTextFile('notes.text')).toBe(true);
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
    expect(isSupportedViewerFile('notes.txt')).toBe(true);
    expect(isSupportedViewerFile('a.rs')).toBe(true);
    expect(isSupportedViewerFile('a.exe')).toBe(false);
  });

  it('recognises styling and config extensions that the worker list once missed', () => {
    // Regression: service-worker.isSupportedDocumentUrl used a narrower list,
    // so .scss/.less raw files were rejected on opt-in web auto-open.
    expect(isSupportedViewerFile('https://x.com/styles.scss')).toBe(true);
    expect(isSupportedViewerFile('vars.less')).toBe(true);
    expect(isSupportedViewerFile('app.conf')).toBe(true);
  });

  it('recognises config dotfiles', () => {
    expect(isConfigDotfile('.gitignore')).toBe(true);
    expect(isConfigDotfile('.env')).toBe(true);
    expect(isConfigDotfile('.env.local')).toBe(true);
    expect(isConfigDotfile('.editorconfig')).toBe(true);
    expect(isConfigDotfile('.envrc')).toBe(false);
    expect(isConfigDotfile('notes.txt')).toBe(false);
    expect(isSupportedViewerFile('/repo/.gitignore')).toBe(true);
  });

  it('recognises files with common example/default suffixes by their inner extension', () => {
    expect(isSupportedDocumentFile('README.md.example')).toBe(true);
    expect(isSupportedDiffFile('changes.patch.dist')).toBe(true);
    expect(isSupportedTextFile('notes.txt.default')).toBe(true);
    expect(isSupportedSourceCodeFile('config.yaml.example')).toBe(true);
    expect(isSupportedSourceCodeFile('config.ini.default')).toBe(true);
    expect(isSupportedSourceCodeFile('Dockerfile.example')).toBe(true);
    expect(isSupportedViewerFile('image.png.example')).toBe(false);
  });
});

describe('ALL_SUPPORTED_EXTENSIONS', () => {
  it('is a flat list spanning every category', () => {
    expect(ALL_SUPPORTED_EXTENSIONS).toContain('.md');
    expect(ALL_SUPPORTED_EXTENSIONS).toContain('.patch');
    expect(ALL_SUPPORTED_EXTENSIONS).toContain('.txt');
    expect(ALL_SUPPORTED_EXTENSIONS).toContain('.scss');
  });
});

describe('matchedAutoOpenKey / AUTO_OPEN_CATEGORIES', () => {
  it('returns the extension for files matched by extension', () => {
    expect(matchedAutoOpenKey('https://x.com/d/readme.md?x=1')).toBe('.md');
    expect(matchedAutoOpenKey('a.PATCH')).toBe('.patch');
    expect(matchedAutoOpenKey('notes.txt')).toBe('.txt');
    expect(matchedAutoOpenKey('config.yaml.example')).toBe('.yaml');
    expect(matchedAutoOpenKey('config.ini.default')).toBe('.ini');
  });

  it('returns the lower-cased name for extensionless special files', () => {
    expect(matchedAutoOpenKey('/repo/Dockerfile')).toBe('dockerfile');
    expect(matchedAutoOpenKey('C:\\repo\\Makefile')).toBe('makefile');
    expect(matchedAutoOpenKey('CMakeLists.txt')).toBe('cmakelists.txt');
    expect(matchedAutoOpenKey('Dockerfile.example')).toBe('dockerfile');
  });

  it('returns empty string for unsupported files', () => {
    expect(matchedAutoOpenKey('image.png')).toBe('');
    expect(matchedAutoOpenKey('https://x.com/')).toBe('');
  });

  it('exposes a catalog whose keys all match back', () => {
    const special = AUTO_OPEN_CATEGORIES.find(category => category.id === 'special');
    expect(special.items.some(item => item.key === 'dockerfile')).toBe(true);
    expect(matchedAutoOpenKey('Dockerfile')).toBe('dockerfile');
  });
});

describe('sourceLanguageFromPath', () => {
  it('maps extensions and special names, defaulting to plaintext', () => {
    expect(sourceLanguageFromPath('a.ts')).toBe('typescript');
    expect(sourceLanguageFromPath('a.py')).toBe('python');
    expect(sourceLanguageFromPath('Dockerfile')).toBe('dockerfile');
    expect(sourceLanguageFromPath('config.yaml.example')).toBe('yaml');
    expect(sourceLanguageFromPath('config.ini.default')).toBe('ini');
    expect(sourceLanguageFromPath('mystery.unknown')).toBe('plaintext');
  });
});

describe('detectFormat', () => {
  it('prefers name/extension then falls back to mime type', () => {
    expect(detectFormat({ name: 'a.md' })).toBe(FORMAT_IDS.MARKDOWN);
    expect(detectFormat({ name: 'a.patch' })).toBe(FORMAT_IDS.DIFF);
    expect(detectFormat({ name: 'a.ts' })).toBe(FORMAT_IDS.SOURCE_CODE);
    expect(detectFormat({ name: 'notes.txt' })).toBe(FORMAT_IDS.TEXT);
    expect(detectFormat({ name: 'notes.text' })).toBe(FORMAT_IDS.TEXT);
    expect(detectFormat({ name: 'CMakeLists.txt' })).toBe(FORMAT_IDS.SOURCE_CODE);
    expect(detectFormat({ name: 'README.md.example' })).toBe(FORMAT_IDS.MARKDOWN);
    expect(detectFormat({ name: 'changes.patch.dist' })).toBe(FORMAT_IDS.DIFF);
    expect(detectFormat({ name: 'config.ini.default' })).toBe(FORMAT_IDS.SOURCE_CODE);
    expect(detectFormat({ name: 'notes.txt.sample' })).toBe(FORMAT_IDS.TEXT);
    expect(detectFormat({ mimeType: 'text/markdown' })).toBe(FORMAT_IDS.MARKDOWN);
    expect(detectFormat({ mimeType: 'text/plain' })).toBe(FORMAT_IDS.TEXT);
    expect(detectFormat({ mimeType: 'application/json' })).toBe(FORMAT_IDS.SOURCE_CODE);
    expect(detectFormat({ name: 'mystery.bin' })).toBe(FORMAT_IDS.UNKNOWN);
  });
});

describe('detectLineEnding / lineEndingLabel', () => {
  it('detects line ending styles', () => {
    expect(detectLineEnding('a\nb\n')).toBe('lf');
    expect(detectLineEnding('a\r\nb\r\n')).toBe('crlf');
    expect(detectLineEnding('a\rb\r')).toBe('cr');
    expect(detectLineEnding('a\r\nb\nc')).toBe('mixed');
    expect(detectLineEnding('single line')).toBe('none');
  });

  it('labels line ending styles', () => {
    expect(lineEndingLabel('lf')).toBe('LF');
    expect(lineEndingLabel('crlf')).toBe('CRLF');
    expect(lineEndingLabel('cr')).toBe('CR');
    expect(lineEndingLabel('mixed')).toBe('Mixed EOL');
    expect(lineEndingLabel('none')).toBe('No EOL');
  });
});

describe('formatLabel / displayNameFromUrl', () => {
  it('labels formats', () => {
    expect(formatLabel(FORMAT_IDS.MARKDOWN)).toBe('Markdown');
    expect(formatLabel(FORMAT_IDS.DIFF)).toBe('Diff');
    expect(formatLabel(FORMAT_IDS.TEXT)).toBe('Text');
    expect(formatLabel('something-else')).toBe('Unknown');
  });

  it('derives a display name from urls and paths', () => {
    expect(displayNameFromUrl('https://x.com/docs/readme.md')).toBe('readme.md');
    expect(displayNameFromUrl('https://x.com/')).toBe('x.com');
    expect(displayNameFromUrl('/local/path/file.txt')).toBe('file.txt');
  });
});
