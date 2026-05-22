(() => {
  const EXTENSIONS = [
    '.md', '.mkd', '.mdx', '.markdown',
    '.diff', '.patch',
    '.js', '.mjs', '.cjs', '.jsx', '.ts', '.tsx',
    '.html', '.htm', '.css', '.json', '.jsonc', '.yaml', '.yml', '.toml', '.ini',
    '.xml', '.svg', '.sh', '.bash', '.zsh', '.ps1', '.py', '.go', '.java',
    '.c', '.h', '.cpp', '.cc', '.cxx', '.hpp', '.hh', '.hxx', '.rs', '.cs',
    '.php', '.rb', '.sql', '.swift', '.kt', '.kts', '.scala', '.dart', '.lua',
    '.r', '.pl', '.pm', '.ex', '.exs', '.erl', '.hrl', '.clj', '.cljs',
    '.groovy', '.gradle', '.vue', '.svelte', '.dockerfile', '.makefile', '.cmake'
  ];
  const REDIRECT_FLAG = 'devFileViewerRedirecting';

  function hasSupportedExtension(url) {
    try {
      const path = new URL(url).pathname.toLowerCase();
      return EXTENSIONS.some(ext => path.endsWith(ext));
    } catch {
      return false;
    }
  }

  function isPlainTextDocument() {
    const contentType = document.contentType || '';
    if (/^(text\/plain|text\/markdown|application\/octet-stream)/i.test(contentType)) return true;

    // Chrome often displays raw text documents as a body with one PRE element.
    const body = document.body;
    return Boolean(body && body.children.length === 1 && body.firstElementChild?.tagName === 'PRE');
  }

  function shouldOpenInViewer() {
    if (!hasSupportedExtension(location.href)) return false;
    if (sessionStorage.getItem(REDIRECT_FLAG) === '1') return false;
    if (!['http:', 'https:', 'file:'].includes(location.protocol)) return false;
    return isPlainTextDocument();
  }

  function getDocumentText() {
    const pre = document.body?.children?.length === 1 && document.body.firstElementChild?.tagName === 'PRE'
      ? document.body.firstElementChild
      : null;
    return pre?.innerText ?? document.body?.innerText ?? document.documentElement?.innerText ?? '';
  }


function looksLikeHtmlSource(text = '', mimeType = '') {
  const value = String(text || '').trimStart();
  if (!value || /^\s*(?:<\?xml\b|<svg\b|<rss\b|<feed\b)/i.test(value)) return false;
  const sample = value.slice(0, 12000);
  if (/^\s*(?:<!doctype\s+html\b|<html\b|<head\b|<body\b|<meta\b|<title\b|<link\b|<script\b|<style\b|<div\b|<span\b|<main\b|<section\b|<article\b|<template\b)/i.test(sample)) return true;
  if (/(?:<!doctype\s+html\b|<html\b[\s>]|<\/html>|<head\b[\s>]|<\/head>|<body\b[\s>]|<\/body>|<script\b[\s>]|<\/script>|<style\b[\s>]|<\/style>)/i.test(sample)) return true;
  return /^text\/html/i.test(String(mimeType || ''));
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type !== 'DETECT_HTML_SOURCE_DOCUMENT') return false;

  const text = getDocumentText();
  const mimeType = document.contentType || '';
  sendResponse({
    ok: true,
    isHtmlSource: looksLikeHtmlSource(text, mimeType),
    url: location.href,
    title: document.title || '',
    mimeType,
    text
  });
  return true;
});

  if (!shouldOpenInViewer()) return;

  sessionStorage.setItem(REDIRECT_FLAG, '1');

  chrome.runtime.sendMessage({
    type: 'OPEN_VIEWER_FOR_SNAPSHOT',
    url: location.href,
    title: document.title || '',
    mimeType: document.contentType || '',
    text: getDocumentText()
  }, response => {
    if (chrome.runtime.lastError || !response?.ok) {
      sessionStorage.removeItem(REDIRECT_FLAG);
      // Do not navigate to a chrome-extension:// URL from the page context.
      // Chrome may block that navigation as ERR_BLOCKED_BY_CLIENT.
      console.warn('Dev File Viewer could not open this document:', chrome.runtime.lastError || response);
    }
  });
})();
