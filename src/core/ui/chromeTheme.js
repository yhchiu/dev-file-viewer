// Tints the standalone extension pages (settings, popup) so they feel connected
// to the viewer on the two dimensions that matter cross-surface: light/dark and
// the accent color. It deliberately does NOT pull in the full reading themes
// (Bloom/Forge/Folio document styling) — only their light/dark mapping and
// accent — so forms stay readable. Mirrors the viewer's resolveThemePreference.

export const THEME_KEY = 'devFileViewer:theme';

const ACCENT_BY_THEME = {
  bloom: {
    accent: '#6d5bf6',
    soft: 'rgba(109, 91, 246, .14)',
    border: 'rgba(109, 91, 246, .5)',
    ring: 'rgba(109, 91, 246, .4)'
  },
  forge: {
    accent: '#3dd7c9',
    soft: 'rgba(61, 215, 201, .16)',
    border: 'rgba(61, 215, 201, .55)',
    ring: 'rgba(61, 215, 201, .4)'
  },
  folio: {
    accent: '#1f5d4c',
    soft: 'rgba(31, 93, 76, .14)',
    border: 'rgba(31, 93, 76, .5)',
    ring: 'rgba(31, 93, 76, .4)'
  }
};

function prefersDarkScheme() {
  return Boolean(globalThis.matchMedia?.('(prefers-color-scheme: dark)')?.matches);
}

// Mirror of the viewer's resolveThemePreference: legacy aliases (light/dark),
// "system" maps to bloom/forge by OS scheme, and color scheme follows the
// resolved app theme (only Forge is dark).
export function resolveChromeTheme(preference, prefersDark = false) {
  let pref = preference;
  if (pref === 'light') pref = 'bloom';
  if (pref === 'dark') pref = 'forge';
  if (!['system', 'bloom', 'forge', 'folio'].includes(pref)) pref = 'system';

  const appTheme = pref === 'system' ? (prefersDark ? 'forge' : 'bloom') : pref;
  return { appTheme, colorScheme: appTheme === 'forge' ? 'dark' : 'light' };
}

function applyChromeTheme(doc, preference) {
  const { appTheme, colorScheme } = resolveChromeTheme(preference, prefersDarkScheme());
  const root = doc.documentElement;
  root.dataset.theme = colorScheme;

  const palette = ACCENT_BY_THEME[appTheme];
  if (!palette) return;
  root.style.setProperty('--accent', palette.accent);
  root.style.setProperty('--accent-soft', palette.soft);
  root.style.setProperty('--accent-border', palette.border);
  root.style.setProperty('--ring', palette.ring);
}

// Apply the stored viewer theme to this page, then keep it in sync with later
// theme changes (storage) and OS scheme changes (relevant when preference is
// "system"). Safe to call once on page load.
export async function syncChromeTheme(doc = document) {
  let preference = 'system';
  try {
    const stored = await chrome.storage.local.get(THEME_KEY);
    preference = stored[THEME_KEY] || 'system';
  } catch {
    // Storage unavailable; keep the system default.
  }

  applyChromeTheme(doc, preference);

  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes[THEME_KEY]) {
        preference = changes[THEME_KEY].newValue || 'system';
        applyChromeTheme(doc, preference);
      }
    });
  } catch {
    // onChanged unavailable; the static apply above is enough.
  }

  globalThis
    .matchMedia?.('(prefers-color-scheme: dark)')
    ?.addEventListener?.('change', () => applyChromeTheme(doc, preference));
}
