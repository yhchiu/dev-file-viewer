import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import css from 'highlight.js/lib/languages/css';
import diff from 'highlight.js/lib/languages/diff';
import go from 'highlight.js/lib/languages/go';
import ini from 'highlight.js/lib/languages/ini';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import markdown from 'highlight.js/lib/languages/markdown';
import php from 'highlight.js/lib/languages/php';
import powershell from 'highlight.js/lib/languages/powershell';
import python from 'highlight.js/lib/languages/python';
import ruby from 'highlight.js/lib/languages/ruby';
import rust from 'highlight.js/lib/languages/rust';
import sql from 'highlight.js/lib/languages/sql';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';

const LANGUAGE_MODULES = {
  bash,
  c,
  cpp,
  css,
  diff,
  go,
  ini,
  java,
  javascript,
  json,
  markdown,
  php,
  powershell,
  python,
  ruby,
  rust,
  sql,
  typescript,
  xml,
  yaml
};

const LANGUAGE_ALIASES = new Map([
  ['sh', 'bash'],
  ['shell', 'bash'],
  ['zsh', 'bash'],
  ['ps1', 'powershell'],
  ['pwsh', 'powershell'],
  ['js', 'javascript'],
  ['mjs', 'javascript'],
  ['cjs', 'javascript'],
  ['jsx', 'javascript'],
  ['ts', 'typescript'],
  ['tsx', 'typescript'],
  ['html', 'xml'],
  ['htm', 'xml'],
  ['svg', 'xml'],
  ['yml', 'yaml'],
  ['py', 'python'],
  ['golang', 'go'],
  ['cc', 'cpp'],
  ['cxx', 'cpp'],
  ['c++', 'cpp'],
  ['hpp', 'cpp'],
  ['hh', 'cpp'],
  ['hxx', 'cpp'],
  ['h', 'c'],
  ['rs', 'rust'],
  ['rb', 'ruby'],
  ['md', 'markdown'],
  ['mkd', 'markdown'],
  ['mdx', 'markdown'],
  ['patch', 'diff'],
  ['plaintext', 'plaintext'],
  ['text', 'plaintext'],
  ['txt', 'plaintext'],
  ['plain', 'plaintext'],
  ['mermaid', 'mermaid']
]);

let registered = false;

function registerLanguages() {
  if (registered) return;
  for (const [name, language] of Object.entries(LANGUAGE_MODULES)) {
    hljs.registerLanguage(name, language);
  }
  registered = true;
}

export function normalizeLanguageName(languageName = '') {
  const firstToken = String(languageName)
    .trim()
    .split(/\s+/)[0]
    .replace(/^language-/, '')
    .replace(/^lang-/, '')
    .toLowerCase();

  return LANGUAGE_ALIASES.get(firstToken) || firstToken;
}

export function highlightMarkdownCodeBlocks(root) {
  registerLanguages();

  const codeBlocks = root.querySelectorAll('pre > code');
  for (const code of codeBlocks) {
    const rawLanguage = [...code.classList]
      .find((className) => className.startsWith('language-') || className.startsWith('lang-'))
      ?.replace(/^language-/, '')
      ?.replace(/^lang-/, '');

    const language = normalizeLanguageName(rawLanguage);

    if (!language || language === 'plaintext' || language === 'mermaid') {
      code.classList.add('hljs');
      if (language && language !== 'mermaid') code.dataset.language = 'plain text';
      continue;
    }

    try {
      if (!hljs.getLanguage(language)) {
        code.classList.add('hljs');
        code.dataset.language = rawLanguage || 'plain text';
        continue;
      }

      const result = hljs.highlight(code.textContent || '', {
        language,
        ignoreIllegals: true
      });

      code.innerHTML = result.value;
      code.classList.add('hljs', `language-${language}`);
      code.dataset.language = language;
    } catch {
      code.classList.add('hljs');
      code.dataset.language = rawLanguage || 'plain text';
    }
  }
}
