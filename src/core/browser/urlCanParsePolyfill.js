// @braintree/sanitize-url (pulled in by mermaid) calls the static
// URL.canParse, which Chrome only ships from version 120, while the
// extension supports Chrome 111+. Installs an equivalent fallback so
// diagram rendering works on the older versions.
export function ensureUrlCanParse(urlClass = URL) {
  if (typeof urlClass.canParse === 'function') return false;

  urlClass.canParse = (url, base) => {
    try {
      // Constructed only for its validation side effect, mirroring the
      // native canParse semantics (including base resolution).
      new urlClass(url, base);
      return true;
    } catch {
      return false;
    }
  };
  return true;
}
