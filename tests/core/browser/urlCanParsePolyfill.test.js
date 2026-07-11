import { describe, it, expect } from 'vitest';
import { ensureUrlCanParse } from '../../../src/core/browser/urlCanParsePolyfill.js';

// Stand-in for Chrome <120's URL: constructable with the same validation
// behaviour as the real URL, but without the static canParse.
function makeLegacyUrlClass() {
  return class LegacyURL {
    constructor(url, base) {
      return new URL(url, base);
    }
  };
}

describe('ensureUrlCanParse', () => {
  it('installs a canParse fallback when the class has none', () => {
    const LegacyURL = makeLegacyUrlClass();

    const installed = ensureUrlCanParse(LegacyURL);

    expect(installed).toBe(true);
    expect(typeof LegacyURL.canParse).toBe('function');
  });

  it('leaves an existing canParse untouched', () => {
    const native = () => true;
    class ModernURL {}
    ModernURL.canParse = native;

    const installed = ensureUrlCanParse(ModernURL);

    expect(installed).toBe(false);
    expect(ModernURL.canParse).toBe(native);
  });

  it('returns true for a valid absolute URL', () => {
    const LegacyURL = makeLegacyUrlClass();
    ensureUrlCanParse(LegacyURL);

    expect(LegacyURL.canParse('https://example.com/docs/readme.md')).toBe(true);
  });

  it('returns false for an invalid URL', () => {
    const LegacyURL = makeLegacyUrlClass();
    ensureUrlCanParse(LegacyURL);

    expect(LegacyURL.canParse('not a url')).toBe(false);
    expect(LegacyURL.canParse('')).toBe(false);
  });

  it('resolves relative URLs against a base', () => {
    const LegacyURL = makeLegacyUrlClass();
    ensureUrlCanParse(LegacyURL);

    expect(LegacyURL.canParse('/docs/readme.md', 'https://example.com')).toBe(true);
    expect(LegacyURL.canParse('/docs/readme.md', 'not a base')).toBe(false);
  });

  it('returns false for a relative URL without a base', () => {
    const LegacyURL = makeLegacyUrlClass();
    ensureUrlCanParse(LegacyURL);

    expect(LegacyURL.canParse('/docs/readme.md')).toBe(false);
  });

  it('defaults to patching the global URL class', () => {
    const original = URL.canParse;
    delete URL.canParse;
    try {
      const installed = ensureUrlCanParse();

      expect(installed).toBe(true);
      expect(URL.canParse('https://example.com/')).toBe(true);
      expect(URL.canParse('not a url')).toBe(false);
    } finally {
      URL.canParse = original;
    }
  });
});
