export const DOCUMENT_EXTENSIONS = new Set(['.md', '.mkd', '.mdx', '.markdown']);

export const DIFF_EXTENSIONS = new Set(['.diff', '.patch']);

export const TEXT_EXTENSIONS = new Set(['.txt', '.text']);

export const SOURCE_CODE_EXTENSIONS = new Set([
  '.js',
  '.mjs',
  '.cjs',
  '.jsx',
  '.ts',
  '.tsx',
  '.html',
  '.htm',
  '.css',
  '.scss',
  '.sass',
  '.less',
  '.json',
  '.jsonc',
  '.yaml',
  '.yml',
  '.toml',
  '.ini',
  '.conf',
  '.cfg',
  '.env',
  '.xml',
  '.svg',
  '.sh',
  '.bash',
  '.zsh',
  '.ps1',
  '.py',
  '.go',
  '.java',
  '.c',
  '.h',
  '.cpp',
  '.cc',
  '.cxx',
  '.hpp',
  '.hh',
  '.hxx',
  '.rs',
  '.cs',
  '.php',
  '.rb',
  '.sql',
  '.swift',
  '.kt',
  '.kts',
  '.scala',
  '.dart',
  '.lua',
  '.r',
  '.pl',
  '.pm',
  '.ex',
  '.exs',
  '.erl',
  '.hrl',
  '.clj',
  '.cljs',
  '.groovy',
  '.gradle',
  '.vue',
  '.svelte',
  '.dockerfile',
  '.makefile',
  '.cmake'
]);

// Flat list of every supported extension, for file-picker `accept` filters.
export const ALL_SUPPORTED_EXTENSIONS = [
  ...DOCUMENT_EXTENSIONS,
  ...DIFF_EXTENSIONS,
  ...TEXT_EXTENSIONS,
  ...SOURCE_CODE_EXTENSIONS
];

// Common config dotfiles whose leading dot is the whole name, so getExtension()
// reads no extension for them. Recognized so they open as plain-text source via
// the file picker and drag-and-drop. Matches the exact name or a `.env.local`
// style suffix, not unrelated names like `.envrc`.
const CONFIG_DOTFILE_PREFIXES = ['.gitignore', '.gitattributes', '.editorconfig', '.env'];

export function isConfigDotfile(value = '') {
  const fileName = getFileName(value).toLowerCase();
  return CONFIG_DOTFILE_PREFIXES.some(
    prefix => fileName === prefix || fileName.startsWith(`${prefix}.`)
  );
}

const SPECIAL_SOURCE_FILE_NAMES = new Map([
  ['dockerfile', 'dockerfile'],
  ['containerfile', 'dockerfile'],
  ['makefile', 'makefile'],
  ['gnumakefile', 'makefile'],
  ['cmakelists.txt', 'cmake'],
  ['rakefile', 'ruby'],
  ['gemfile', 'ruby'],
  ['podfile', 'ruby'],
  ['gradlefile', 'gradle'],
  ['justfile', 'makefile'],
  ['procfile', 'yaml']
]);

const EXTENSION_LANGUAGE_MAP = new Map([
  ['.js', 'javascript'],
  ['.mjs', 'javascript'],
  ['.cjs', 'javascript'],
  ['.jsx', 'javascript'],
  ['.ts', 'typescript'],
  ['.tsx', 'typescript'],
  ['.html', 'html'],
  ['.htm', 'html'],
  ['.css', 'css'],
  ['.scss', 'css'],
  ['.sass', 'css'],
  ['.less', 'css'],
  ['.json', 'json'],
  ['.jsonc', 'json'],
  ['.yaml', 'yaml'],
  ['.yml', 'yaml'],
  ['.toml', 'ini'],
  ['.ini', 'ini'],
  ['.conf', 'ini'],
  ['.cfg', 'ini'],
  ['.env', 'ini'],
  ['.xml', 'xml'],
  ['.svg', 'xml'],
  ['.sh', 'bash'],
  ['.bash', 'bash'],
  ['.zsh', 'bash'],
  ['.ps1', 'powershell'],
  ['.py', 'python'],
  ['.go', 'go'],
  ['.java', 'java'],
  ['.c', 'c'],
  ['.h', 'c'],
  ['.cpp', 'cpp'],
  ['.cc', 'cpp'],
  ['.cxx', 'cpp'],
  ['.hpp', 'cpp'],
  ['.hh', 'cpp'],
  ['.hxx', 'cpp'],
  ['.rs', 'rust'],
  ['.cs', 'csharp'],
  ['.php', 'php'],
  ['.rb', 'ruby'],
  ['.sql', 'sql'],
  ['.swift', 'swift'],
  ['.kt', 'kotlin'],
  ['.kts', 'kotlin'],
  ['.scala', 'scala'],
  ['.dart', 'dart'],
  ['.lua', 'lua'],
  ['.r', 'r'],
  ['.pl', 'perl'],
  ['.pm', 'perl'],
  ['.ex', 'elixir'],
  ['.exs', 'elixir'],
  ['.erl', 'erlang'],
  ['.hrl', 'erlang'],
  ['.clj', 'clojure'],
  ['.cljs', 'clojure'],
  ['.groovy', 'groovy'],
  ['.gradle', 'gradle'],
  ['.vue', 'xml'],
  ['.svelte', 'xml'],
  ['.dockerfile', 'dockerfile'],
  ['.makefile', 'makefile'],
  ['.cmake', 'cmake']
]);

export const FORMAT_IDS = Object.freeze({
  MARKDOWN: 'markdown',
  SOURCE_CODE: 'source-code',
  TEXT: 'text',
  UNKNOWN: 'unknown',
  DIFF: 'diff'
});

export function getFileName(value = '') {
  const cleanValue = String(value).split(/[?#]/, 1)[0];
  const slashIndex = Math.max(cleanValue.lastIndexOf('/'), cleanValue.lastIndexOf('\\'));
  return slashIndex >= 0 ? cleanValue.slice(slashIndex + 1) : cleanValue;
}

export function getExtension(value = '') {
  const fileName = getFileName(value);
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex <= 0) return '';
  return fileName.slice(dotIndex).toLowerCase();
}

export function isSupportedDocumentFile(value = '') {
  return DOCUMENT_EXTENSIONS.has(getExtension(value));
}

export function isSupportedDiffFile(value = '') {
  return DIFF_EXTENSIONS.has(getExtension(value));
}

export function isSupportedTextFile(value = '') {
  return TEXT_EXTENSIONS.has(getExtension(value));
}

export function isSupportedSourceCodeFile(value = '') {
  return (
    SOURCE_CODE_EXTENSIONS.has(getExtension(value)) ||
    SPECIAL_SOURCE_FILE_NAMES.has(getFileName(value).toLowerCase()) ||
    isConfigDotfile(value)
  );
}

export function isSupportedViewerFile(value = '') {
  return (
    isSupportedDocumentFile(value) ||
    isSupportedDiffFile(value) ||
    isSupportedSourceCodeFile(value) ||
    isSupportedTextFile(value)
  );
}

export function sourceLanguageFromPath(value = '') {
  const fileName = getFileName(value).toLowerCase();
  const special = SPECIAL_SOURCE_FILE_NAMES.get(fileName);
  if (special) return special;
  return EXTENSION_LANGUAGE_MAP.get(getExtension(value)) || 'plaintext';
}

export function formatLabel(format) {
  if (format === FORMAT_IDS.MARKDOWN) return 'Markdown';
  if (format === FORMAT_IDS.SOURCE_CODE) return 'Source';
  if (format === FORMAT_IDS.TEXT) return 'Text';
  if (format === FORMAT_IDS.DIFF) return 'Diff';
  return 'Unknown';
}

export function detectLineEnding(text = '') {
  const value = String(text || '');
  let crlf = 0;
  let lf = 0;
  let cr = 0;

  for (let index = 0; index < value.length; index += 1) {
    const char = value[index];
    if (char === '\r') {
      if (value[index + 1] === '\n') {
        crlf += 1;
        index += 1;
      } else {
        cr += 1;
      }
      continue;
    }

    if (char === '\n') lf += 1;
  }

  const kinds = [crlf > 0, lf > 0, cr > 0].filter(Boolean).length;
  if (kinds === 0) return 'none';
  if (kinds > 1) return 'mixed';
  if (crlf > 0) return 'crlf';
  if (lf > 0) return 'lf';
  return 'cr';
}

export function lineEndingLabel(lineEnding) {
  if (lineEnding === 'crlf') return 'CRLF';
  if (lineEnding === 'lf') return 'LF';
  if (lineEnding === 'cr') return 'CR';
  if (lineEnding === 'mixed') return 'Mixed EOL';
  return 'No EOL';
}

export function detectFormat({ url = '', name = '', mimeType = '' } = {}) {
  const target = name || url;
  if (isSupportedDocumentFile(target)) return FORMAT_IDS.MARKDOWN;
  if (/markdown|mdx/i.test(mimeType)) return FORMAT_IDS.MARKDOWN;
  if (isSupportedDiffFile(target)) return FORMAT_IDS.DIFF;
  if (/^(text\/x-diff|text\/x-patch)$/i.test(String(mimeType).split(';', 1)[0]))
    return FORMAT_IDS.DIFF;
  if (isSupportedSourceCodeFile(target)) return FORMAT_IDS.SOURCE_CODE;
  if (isSupportedTextFile(target)) return FORMAT_IDS.TEXT;
  if (
    /application\/(json|javascript|xml)|text\/(css|html|javascript|xml|x-python|x-go|x-c|x-c\+\+|x-java-source|x-shellscript)/i.test(
      mimeType
    )
  ) {
    return FORMAT_IDS.SOURCE_CODE;
  }
  if (/^text\/plain\b/i.test(mimeType)) return FORMAT_IDS.TEXT;
  return FORMAT_IDS.UNKNOWN;
}

export function displayNameFromUrl(url = '') {
  try {
    const parsed = new URL(url);
    const parts = decodeURIComponent(parsed.pathname).split('/').filter(Boolean);
    return parts.at(-1) || parsed.hostname || 'Untitled';
  } catch {
    const parts = String(url).split(/[\\/]/).filter(Boolean);
    return parts.at(-1) || 'Untitled';
  }
}

const SPECIAL_SOURCE_FILE_DISPLAY = new Map([
  ['dockerfile', 'Dockerfile'],
  ['containerfile', 'Containerfile'],
  ['makefile', 'Makefile'],
  ['gnumakefile', 'GNUmakefile'],
  ['cmakelists.txt', 'CMakeLists.txt'],
  ['rakefile', 'Rakefile'],
  ['gemfile', 'Gemfile'],
  ['podfile', 'Podfile'],
  ['gradlefile', 'Gradlefile'],
  ['justfile', 'Justfile'],
  ['procfile', 'Procfile']
]);

function toExtensionItems(extensions) {
  return [...extensions].map(ext => ({ key: ext, label: ext }));
}

// Categories rendered by the options-page auto-open settings UI. Each item's
// `key` is what matchedAutoOpenKey() returns and what the disabled list stores.
export const AUTO_OPEN_CATEGORIES = Object.freeze([
  { id: 'markdown', labelKey: 'catMarkdown', items: toExtensionItems(DOCUMENT_EXTENSIONS) },
  { id: 'diff', labelKey: 'catDiff', items: toExtensionItems(DIFF_EXTENSIONS) },
  { id: 'source', labelKey: 'catSource', items: toExtensionItems(SOURCE_CODE_EXTENSIONS) },
  { id: 'text', labelKey: 'catText', items: toExtensionItems(TEXT_EXTENSIONS) },
  {
    id: 'special',
    labelKey: 'catSpecial',
    items: [...SPECIAL_SOURCE_FILE_NAMES.keys()].map(name => ({
      key: name,
      label: SPECIAL_SOURCE_FILE_DISPLAY.get(name) || name
    }))
  }
]);

const ALL_AUTO_OPEN_EXTENSIONS = new Set([
  ...DOCUMENT_EXTENSIONS,
  ...DIFF_EXTENSIONS,
  ...TEXT_EXTENSIONS,
  ...SOURCE_CODE_EXTENSIONS
]);

// Returns the catalog key that makes `value` eligible for auto-open: an
// extension like ".md" or a special filename like "dockerfile". Returns "" when
// the file is not a supported type. Mirrors isSupportedViewerFile() membership.
export function matchedAutoOpenKey(value = '') {
  // Check special filenames first (matching sourceLanguageFromPath), so a file
  // like CMakeLists.txt maps to its special key rather than the ".txt" key.
  const fileName = getFileName(value).toLowerCase();
  if (SPECIAL_SOURCE_FILE_NAMES.has(fileName)) return fileName;
  const extension = getExtension(value);
  if (extension && ALL_AUTO_OPEN_EXTENSIONS.has(extension)) return extension;
  return '';
}
