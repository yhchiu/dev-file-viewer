const HTML_SOURCE_START_RE =
  /^\s*(?:<!doctype\s+html\b|<html\b|<head\b|<body\b|<meta\b|<title\b|<link\b|<script\b|<style\b|<div\b|<span\b|<main\b|<section\b|<article\b|<template\b)/i;
const HTML_SOURCE_SIGNAL_RE =
  /(?:<!doctype\s+html\b|<html\b[\s>]|<\/html>|<head\b[\s>]|<\/head>|<body\b[\s>]|<\/body>|<script\b[\s>]|<\/script>|<style\b[\s>]|<\/style>)/i;
const NON_HTML_SOURCE_START_RE = /^\s*(?:<\?xml\b|<svg\b|<rss\b|<feed\b)/i;

export function looksLikeHtmlSource(text = '', context = {}) {
  const value = stripBom(String(text || '')).trimStart();
  if (!value) return false;
  if (NON_HTML_SOURCE_START_RE.test(value)) return false;

  const sample = value.slice(0, 12000);
  const mimeType = String(context.mimeType || '')
    .split(';', 1)[0]
    .trim()
    .toLowerCase();

  if (HTML_SOURCE_START_RE.test(sample)) return true;
  if (mimeType === 'text/html' && HTML_SOURCE_SIGNAL_RE.test(sample)) return true;

  // Raw HTML source may be served as text/plain or application/octet-stream.
  // Require a strong signal to avoid misclassifying Markdown or ordinary prose.
  if (
    /^(text\/plain|application\/octet-stream)?$/i.test(mimeType) &&
    HTML_SOURCE_SIGNAL_RE.test(sample)
  ) {
    return true;
  }

  return false;
}

function stripBom(value) {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}
