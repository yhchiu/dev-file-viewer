import { t } from '../../core/i18n/i18n.js';
import { nextFrame } from '../domUtils.js';

const SCROLL_ENABLED_KEY = 'devFileViewer:rememberScrollEnabled';
const SCROLL_POSITIONS_KEY = 'devFileViewer:scrollPositions';

// Decide the scrollTop to restore for a document: an explicit option wins, then a
// saved position, otherwise the top.
export function resolveRestoreScrollTop(savedTop, optionScrollTop) {
  if (Number.isFinite(optionScrollTop)) return optionScrollTop;
  return Number.isFinite(savedTop) ? savedTop : 0;
}

// Owns opt-in, per-document scroll-position memory (persisted to session storage).
// Runtime per-tab scroll and anchor/active-heading concerns live elsewhere; this
// controller calls back to the host for those.
export class ScrollMemoryController {
  constructor(host) {
    this.host = host;
    this.elements = host.elements;
    this.enabled = false;
    this.positions = {};
    this.saveTimer = 0;
  }

  async restore() {
    const stored = await chrome.storage.session.get([SCROLL_ENABLED_KEY, SCROLL_POSITIONS_KEY]);
    this.enabled = Boolean(stored[SCROLL_ENABLED_KEY]);
    this.positions = stored[SCROLL_POSITIONS_KEY] || {};
    this.elements.rememberScroll.checked = this.enabled;
  }

  bindEvents() {
    this.elements.rememberScroll.addEventListener('change', () =>
      this.setRememberScroll(this.elements.rememberScroll.checked)
    );
  }

  async setRememberScroll(enabled) {
    this.enabled = Boolean(enabled);
    this.elements.rememberScroll.checked = this.enabled;
    await chrome.storage.session.set({ [SCROLL_ENABLED_KEY]: this.enabled });

    if (this.enabled) {
      await this.saveCurrentScrollPosition();
      this.host.setStatus(t('statusScrollEnabled'), 'info');
    } else {
      this.host.setStatus(t('statusScrollDisabled'), 'info');
    }
  }

  scheduleSaveScrollPosition() {
    if (!this.enabled || !this.host.currentDocKey) return;
    clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      this.saveCurrentScrollPosition().catch(() => {});
    }, 180);
  }

  async saveCurrentScrollPosition() {
    if (!this.enabled || !this.host.currentDocKey) return;
    this.positions[this.host.currentDocKey] = {
      top: this.host.scrollRoot.scrollTop,
      updatedAt: Date.now()
    };
    await chrome.storage.session.set({ [SCROLL_POSITIONS_KEY]: this.positions });
  }

  async restoreOrResetScroll(doc, options = {}) {
    const docKey = this.host.getDocumentKey(doc);
    const anchor = options.anchor;

    await nextFrame();

    if (anchor && this.host.scrollToAnchor(anchor)) return;

    const saved = this.enabled ? this.positions[docKey] : null;
    this.host.scrollRoot.scrollTop = resolveRestoreScrollTop(saved?.top, options.scrollTop);
    this.host.fileTabs.saveActiveTabRuntimeScroll();
    this.host.outline.scheduleActiveHeadingUpdate();
  }
}
