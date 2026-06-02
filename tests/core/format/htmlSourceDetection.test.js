import { describe, it, expect } from 'vitest';
import { looksLikeHtmlSource } from '../../../src/core/format/htmlSourceDetection.js';

describe('looksLikeHtmlSource', () => {
  it('detects documents that start with HTML tags', () => {
    expect(looksLikeHtmlSource('<!doctype html><html></html>')).toBe(true);
    expect(looksLikeHtmlSource('<div>hi</div>')).toBe(true);
  });

  it('rejects xml / svg / rss / feed roots', () => {
    expect(looksLikeHtmlSource('<?xml version="1.0"?><root/>')).toBe(false);
    expect(looksLikeHtmlSource('<svg viewBox="0 0 1 1"></svg>')).toBe(false);
    expect(looksLikeHtmlSource('<rss></rss>')).toBe(false);
  });

  it('rejects ordinary markdown prose', () => {
    expect(looksLikeHtmlSource('# Title\n\nSome <not a tag prose.')).toBe(false);
  });

  it('uses mime + signal for non-leading HTML', () => {
    expect(looksLikeHtmlSource('blah blah <body> blah', { mimeType: 'text/html' })).toBe(true);
    expect(looksLikeHtmlSource('prefix </script> suffix', { mimeType: 'text/plain' })).toBe(true);
    // plain text with no strong HTML signal stays false
    expect(looksLikeHtmlSource('just a sentence with < and >', { mimeType: 'text/plain' })).toBe(false);
  });

  it('strips a BOM before testing', () => {
    expect(looksLikeHtmlSource('﻿<!doctype html>')).toBe(true);
  });

  it('returns false for empty input', () => {
    expect(looksLikeHtmlSource('')).toBe(false);
  });
});
