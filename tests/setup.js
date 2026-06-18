import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { vi } from 'vitest';

// Load the real English catalog so tests exercise actual strings and also
// indirectly validate public/_locales/en/messages.json. Resolve from cwd
// (the project root where vitest runs) — under the jsdom environment
// import.meta.url is an http:// URL that readFileSync rejects.
const messages = JSON.parse(
  readFileSync(resolve(process.cwd(), 'public/_locales/en/messages.json'), 'utf8')
);

// Faithful-enough re-implementation of chrome.i18n.getMessage:
// resolves $PLACEHOLDER$ tokens (case-insensitive) whose content is "$N$"
// against the positional substitutions argument.
function getMessage(key, substitutions) {
  if (key === '@@ui_locale') return 'en';
  if (key === '@@bidi_dir') return 'ltr';

  const entry = messages[key];
  if (!entry) return '';

  const subs =
    substitutions == null ? [] : Array.isArray(substitutions) ? substitutions : [substitutions];
  const placeholders = entry.placeholders || {};

  return entry.message.replace(/\$([a-zA-Z0-9_]+)\$/g, (whole, name) => {
    const ph = placeholders[name] || placeholders[name.toLowerCase()];
    if (!ph) return whole;
    const index = /^\$(\d+)$/.exec(ph.content || '');
    if (index) {
      const value = subs[Number(index[1]) - 1];
      return value == null ? '' : String(value);
    }
    return ph.content || '';
  });
}

globalThis.chrome = {
  i18n: { getMessage },
  runtime: {
    id: 'test-extension-id',
    getURL: path => `chrome-extension://test-extension-id/${path}`,
    lastError: null
  },
  storage: {
    local: { get: vi.fn(async () => ({})), set: vi.fn(async () => {}) },
    session: { get: vi.fn(async () => ({})), set: vi.fn(async () => {}) }
  }
};
