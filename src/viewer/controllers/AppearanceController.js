import { t } from '../../core/i18n/i18n.js';
import {
  contentWidthLabel,
  normalizeThemePreference,
  resolveThemePreference,
  themeLabel
} from '../viewerHelpers.js';
import { nextFrame } from '../domUtils.js';
import {
  DEFAULT_VIEWER_FONT_SIZE,
  VIEWER_FONT_SIZE_KEY,
  clampViewerFontSize,
  viewerFontSizeProgress
} from '../../core/ui/viewerFontSize.js';

export { clampViewerFontSize } from '../../core/ui/viewerFontSize.js';

const THEME_KEY = 'devFileViewer:theme';
const CONTENT_WIDTH_KEY = 'devFileViewer:contentWidth';
const DEFAULT_THEME = 'system';
const DEFAULT_CONTENT_WIDTH = 'comfortable';
const CONTENT_WIDTHS = {
  narrow: '760px',
  comfortable: '920px',
  wide: '1180px',
  full: '100%'
};

// Owns the viewer appearance preferences: color theme, content width, and font
// size. Each preference restores from chrome.storage.local, applies to the DOM
// (CSS vars / data-attributes), and persists on change.
export class AppearanceController {
  constructor(host) {
    this.host = host;
    this.elements = host.elements;
    this.themePreference = DEFAULT_THEME;
    this.contentWidth = DEFAULT_CONTENT_WIDTH;
    this.viewerFontSize = DEFAULT_VIEWER_FONT_SIZE;
    this.themeMediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)') || null;
  }

  async restore() {
    await this.restoreTheme();
    await this.restoreContentWidth();
    await this.restoreViewerFontSize();
  }

  bindEvents() {
    this.elements.contentWidth.addEventListener('change', () =>
      this.setContentWidth(this.elements.contentWidth.value)
    );
    this.elements.theme?.addEventListener('change', () =>
      this.setThemePreference(this.elements.theme.value)
    );
    this.elements.viewerFontSizeRange?.addEventListener('input', () =>
      this.applyViewerFontSize(this.elements.viewerFontSizeRange.value)
    );
    this.elements.viewerFontSizeRange?.addEventListener('change', () =>
      this.setViewerFontSize(this.elements.viewerFontSizeRange.value)
    );
    this.elements.viewerFontSizeInput?.addEventListener('change', () =>
      this.setViewerFontSize(this.elements.viewerFontSizeInput.value)
    );
    this.themeMediaQuery?.addEventListener?.('change', () => {
      if (this.themePreference === 'system') this.applyTheme();
    });
  }

  /* ---------- Theme ---------- */

  async restoreTheme() {
    const stored = await chrome.storage.local.get(THEME_KEY);
    this.themePreference = normalizeThemePreference(stored[THEME_KEY], DEFAULT_THEME);
    if (this.elements.theme) this.elements.theme.value = this.themePreference;
    this.applyTheme();
  }

  async setThemePreference(value) {
    this.themePreference = normalizeThemePreference(value, DEFAULT_THEME);
    if (this.elements.theme && this.elements.theme.value !== this.themePreference) {
      this.elements.theme.value = this.themePreference;
    }
    await chrome.storage.local.set({ [THEME_KEY]: this.themePreference });
    this.applyTheme();
    this.host.setStatus(t('statusThemeSet', [themeLabel(this.themePreference)]), 'success');
  }

  applyTheme() {
    const resolved = this.resolveTheme();
    document.documentElement.dataset.theme = resolved.colorScheme;
    document.documentElement.dataset.appTheme = resolved.appTheme;
    document.documentElement.dataset.themePreference = this.themePreference;
    document.documentElement.style.colorScheme = resolved.colorScheme;
    document.body?.setAttribute('data-theme', resolved.colorScheme);
    document.body?.setAttribute('data-app-theme', resolved.appTheme);
    this.elements.app?.setAttribute('data-theme', resolved.colorScheme);
    this.elements.app?.setAttribute('data-app-theme', resolved.appTheme);
  }

  resolveTheme() {
    return resolveThemePreference(this.themePreference, Boolean(this.themeMediaQuery?.matches));
  }

  /* ---------- Content width ---------- */

  async restoreContentWidth() {
    const stored = await chrome.storage.local.get(CONTENT_WIDTH_KEY);
    this.applyContentWidth(stored[CONTENT_WIDTH_KEY] || DEFAULT_CONTENT_WIDTH);
  }

  applyContentWidth(value) {
    const widthKey = Object.prototype.hasOwnProperty.call(CONTENT_WIDTHS, value)
      ? value
      : DEFAULT_CONTENT_WIDTH;
    this.contentWidth = widthKey;
    this.elements.contentWidth.value = widthKey;
    this.elements.app.classList.toggle('content-width-full', widthKey === 'full');
    this.elements.app.style.setProperty('--markdown-body-width', CONTENT_WIDTHS[widthKey]);
  }

  async setContentWidth(value) {
    this.applyContentWidth(value);
    await chrome.storage.local.set({ [CONTENT_WIDTH_KEY]: this.contentWidth });
    this.host.setStatus(t('statusContentWidthSet', [contentWidthLabel(this.contentWidth)]), 'info');
    await nextFrame();
  }

  /* ---------- Viewer font size ---------- */

  async restoreViewerFontSize() {
    const stored = await chrome.storage.local.get(VIEWER_FONT_SIZE_KEY);
    this.applyViewerFontSize(stored[VIEWER_FONT_SIZE_KEY] || DEFAULT_VIEWER_FONT_SIZE);
  }

  applyViewerFontSize(value) {
    this.viewerFontSize = clampViewerFontSize(value);
    this.elements.preview.style.setProperty('--viewer-font-size', `${this.viewerFontSize}px`);
    if (this.elements.viewerFontSizeRange) {
      const progress = viewerFontSizeProgress(this.viewerFontSize);
      this.elements.viewerFontSizeRange.value = String(this.viewerFontSize);
      this.elements.viewerFontSizeRange.style.setProperty(
        '--viewer-font-size-progress',
        `${progress}%`
      );
    }
    if (this.elements.viewerFontSizeInput)
      this.elements.viewerFontSizeInput.value = String(this.viewerFontSize);
  }

  async setViewerFontSize(value) {
    this.applyViewerFontSize(value);
    await chrome.storage.local.set({ [VIEWER_FONT_SIZE_KEY]: this.viewerFontSize });
    this.host.setStatus(t('statusViewerTextSizeSet', [String(this.viewerFontSize)]), 'info');
  }
}
