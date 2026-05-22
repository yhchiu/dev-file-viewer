import hljs from 'highlight.js/lib/core';
import bash from 'highlight.js/lib/languages/bash';
import c from 'highlight.js/lib/languages/c';
import cpp from 'highlight.js/lib/languages/cpp';
import csharp from 'highlight.js/lib/languages/csharp';
import clojure from 'highlight.js/lib/languages/clojure';
import cmake from 'highlight.js/lib/languages/cmake';
import dart from 'highlight.js/lib/languages/dart';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import elixir from 'highlight.js/lib/languages/elixir';
import erlang from 'highlight.js/lib/languages/erlang';
import gradle from 'highlight.js/lib/languages/gradle';
import groovy from 'highlight.js/lib/languages/groovy';
import kotlin from 'highlight.js/lib/languages/kotlin';
import lua from 'highlight.js/lib/languages/lua';
import makefile from 'highlight.js/lib/languages/makefile';
import perl from 'highlight.js/lib/languages/perl';
import r from 'highlight.js/lib/languages/r';
import scala from 'highlight.js/lib/languages/scala';
import swift from 'highlight.js/lib/languages/swift';
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
  csharp,
  clojure,
  cmake,
  css,
  dart,
  diff,
  dockerfile,
  elixir,
  erlang,
  go,
  gradle,
  groovy,
  ini,
  java,
  javascript,
  json,
  kotlin,
  lua,
  makefile,
  markdown,
  perl,
  php,
  powershell,
  python,
  r,
  ruby,
  rust,
  scala,
  sql,
  swift,
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
  ['cs', 'csharp'],
  ['rb', 'ruby'],
  ['md', 'markdown'],
  ['mkd', 'markdown'],
  ['mdx', 'markdown'],
  ['patch', 'diff'],
  ['plaintext', 'plaintext'],
  ['text', 'plaintext'],
  ['txt', 'plaintext'],
  ['plain', 'plaintext'],
  ['docker', 'dockerfile'],
  ['dockerfile', 'dockerfile'],
  ['make', 'makefile'],
  ['makefile', 'makefile'],
  ['cmake', 'cmake'],
  ['kt', 'kotlin'],
  ['kts', 'kotlin'],
  ['swift', 'swift'],
  ['scala', 'scala'],
  ['dart', 'dart'],
  ['lua', 'lua'],
  ['r', 'r'],
  ['perl', 'perl'],
  ['pl', 'perl'],
  ['pm', 'perl'],
  ['ex', 'elixir'],
  ['exs', 'elixir'],
  ['erl', 'erlang'],
  ['hrl', 'erlang'],
  ['clj', 'clojure'],
  ['cljs', 'clojure'],
  ['groovy', 'groovy'],
  ['gradle', 'gradle'],
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


export function highlightCodeToHtml(sourceText = '', languageName = '') {
  registerLanguages();

  const language = normalizeLanguageName(languageName);
  if (!language || language === 'plaintext' || language === 'mermaid' || !hljs.getLanguage(language)) {
    return escapeHtml(sourceText);
  }

  try {
    return hljs.highlight(String(sourceText || ''), {
      language,
      ignoreIllegals: true
    }).value;
  } catch {
    return escapeHtml(sourceText);
  }
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
