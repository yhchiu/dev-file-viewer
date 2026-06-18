import { t } from '../../core/i18n/i18n.js';
import { nextFrame } from '../domUtils.js';

const SIDEBAR_COLLAPSED_KEY = 'devFileViewer:sidebarCollapsed';
const SIDEBAR_WIDTH_KEY = 'devFileViewer:sidebarWidth';
const DEFAULT_SIDEBAR_WIDTH = 322;
const MIN_SIDEBAR_WIDTH = 240;
const MAX_SIDEBAR_WIDTH = 560;

// Clamp a sidebar width to [MIN, viewport-limited MAX], rounding and falling back
// to the default for non-positive input. viewportWidth is injectable for testing.
export function clampSidebarWidth(width, viewportWidth = window.innerWidth) {
  const viewportLimit = Math.max(
    MIN_SIDEBAR_WIDTH,
    Math.min(MAX_SIDEBAR_WIDTH, Math.floor(viewportWidth * 0.6))
  );
  const numericWidth = Number.isFinite(width) && width > 0 ? width : DEFAULT_SIDEBAR_WIDTH;
  return Math.min(Math.max(Math.round(numericWidth), MIN_SIDEBAR_WIDTH), viewportLimit);
}

// Owns the sidebar: tab/panel/activity-rail navigation and the collapse + resize
// layout. Calls back to the host to open documents and to keep the floating
// outline positioned.
export class SidebarController {
  constructor(host) {
    this.host = host;
    this.elements = host.elements;
    this.sidebarCollapsed = false;
    this.sidebarWidth = DEFAULT_SIDEBAR_WIDTH;
    this.resizeDrag = null;
    this.activeSidebarPanel = 'open';
    this.activeSidebarTab = 'files';
    this.activeRailTarget = 'open-file';
  }

  async restore() {
    await this.restoreSidebarWidth();
    await this.restoreSidebarState();
  }

  bindEvents() {
    this.elements.sidebarToggle.addEventListener('click', () => this.setSidebarCollapsed(true));
    this.elements.sidebarRestore.addEventListener('click', () => this.setSidebarCollapsed(false));
    this.elements.activityRail?.addEventListener('click', event =>
      this.handleActivityRailFrameClick(event)
    );
    this.elements.sidebarResizer.addEventListener('pointerdown', event =>
      this.startSidebarResize(event)
    );
    this.elements.sidebarResizer.addEventListener('keydown', event =>
      this.handleSidebarResizeKey(event)
    );
    this.elements.sidebarResizer.addEventListener('dblclick', () => this.resetSidebarWidth());
    for (const tab of this.elements.sidebarTabs) {
      tab.addEventListener('click', () => this.setSidebarTab(tab.dataset.sidebarTab));
    }
    for (const button of this.elements.activityRailButtons) {
      button.addEventListener('click', () => {
        this.handleActivityRailClick(button.dataset.railTarget).catch(error => {
          this.host.clearViewerLoading();
          this.host.setStatus(error?.message || String(error), 'error');
        });
      });
    }
  }

  /* ---------- Tab / panel / activity-rail navigation ---------- */

  setSidebarTab(tab) {
    this.applySidebarTab(tab);
  }

  applySidebarTab(tab, options = {}) {
    const nextTab = tab === 'outline' ? 'outline' : 'files';
    this.activeSidebarTab = nextTab;

    this.elements.filesTab.classList.toggle('active', nextTab === 'files');
    this.elements.outlineTab.classList.toggle('active', nextTab === 'outline');
    this.elements.filesTab.setAttribute('aria-selected', String(nextTab === 'files'));
    this.elements.outlineTab.setAttribute('aria-selected', String(nextTab === 'outline'));
    this.elements.filesTab.tabIndex = nextTab === 'files' ? 0 : -1;
    this.elements.outlineTab.tabIndex = nextTab === 'outline' ? 0 : -1;

    this.elements.filesPanel.hidden = nextTab !== 'files';
    this.elements.outlinePanel.hidden = nextTab !== 'outline';
    if (options.showPanel !== false) {
      this.setSidebarPanel('navigator');
      return;
    }

    this.syncActivityRail();
  }

  setSidebarPanel(panel, options = {}) {
    const nextPanel = ['open', 'settings', 'navigator'].includes(panel) ? panel : 'open';
    this.activeSidebarPanel = nextPanel;

    for (const sidebarPanel of this.elements.sidebarPanels) {
      const isActive = sidebarPanel.dataset.sidebarPanel === nextPanel;
      // `hidden` already removes the panel from layout, the a11y tree, and the
      // focus order, so an explicit aria-hidden is redundant. Setting it while a
      // descendant still holds focus is what Chrome blocks, so we omit it.
      sidebarPanel.hidden = !isActive;
    }

    if (options.activeTarget) {
      this.activeRailTarget = options.activeTarget;
    } else if (nextPanel === 'settings') {
      this.activeRailTarget = 'settings';
    } else if (nextPanel === 'navigator') {
      this.activeRailTarget = this.activeSidebarTab === 'outline' ? 'outline' : 'files';
    } else if (!['open-file', 'open-folder', 'open-url'].includes(this.activeRailTarget)) {
      this.activeRailTarget = 'open-file';
    }

    this.syncActivityRail();
  }

  async revealSidebarPanel(panel, options = {}) {
    if (this.sidebarCollapsed) {
      await this.setSidebarCollapsed(false);
    }

    this.setSidebarPanel(panel, options);
    await nextFrame();
  }

  async handleActivityRailClick(target) {
    if (target === 'open-file') {
      await this.revealSidebarPanel('open', { activeTarget: 'open-file' });
      await this.host.openLocalFile();
      return;
    }

    if (target === 'open-folder') {
      await this.revealSidebarPanel('open', { activeTarget: 'open-folder' });
      await this.host.openLocalFolder();
      return;
    }

    if (target === 'open-url') {
      await this.revealSidebarPanel('open', { activeTarget: 'open-url' });
      this.elements.urlBox.hidden = false;
      this.elements.urlInput?.focus();
      return;
    }

    if (target === 'files') {
      await this.revealSidebarPanel('navigator');
      this.setSidebarTab('files');
      this.elements.filesTab?.focus();
      return;
    }

    if (target === 'outline') {
      await this.revealSidebarPanel('navigator');
      this.setSidebarTab('outline');
      this.elements.outlineTab?.focus();
      return;
    }

    if (target === 'settings') {
      await this.revealSidebarPanel('settings', { activeTarget: 'settings' });
      this.elements.contentWidth?.focus();
    }
  }

  syncActivityRail() {
    for (const button of this.elements.activityRailButtons) {
      const isActive = button.dataset.railTarget === this.activeRailTarget;
      button.classList.toggle('is-active', isActive);
      button.removeAttribute('aria-current');
    }
  }

  handleActivityRailFrameClick(event) {
    const target = event.target;
    if (target.closest?.('button, a, input, select, textarea, [role="button"]')) return;
    this.setSidebarCollapsed(!this.sidebarCollapsed);
  }

  /* ---------- Width / resize / collapse ---------- */

  async restoreSidebarWidth() {
    const stored = await chrome.storage.local.get(SIDEBAR_WIDTH_KEY);
    const width = clampSidebarWidth(Number(stored[SIDEBAR_WIDTH_KEY]));
    this.applySidebarWidth(width, { updateAria: true });
  }

  applySidebarWidth(width, options = {}) {
    this.sidebarWidth = clampSidebarWidth(width);
    this.elements.app.style.setProperty('--sidebar-width', `${this.sidebarWidth}px`);
    if (options.updateAria !== false) {
      this.elements.sidebarResizer.setAttribute('aria-valuenow', String(this.sidebarWidth));
      this.elements.sidebarResizer.setAttribute('aria-valuetext', `${this.sidebarWidth} pixels`);
    }
  }

  async persistSidebarWidth() {
    await chrome.storage.local.set({ [SIDEBAR_WIDTH_KEY]: this.sidebarWidth });
  }

  startSidebarResize(event) {
    if (this.sidebarCollapsed || event.button !== 0) return;
    event.preventDefault();
    this.resizeDrag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startWidth: this.sidebarWidth
    };
    this.elements.sidebarResizer.setPointerCapture(event.pointerId);
    this.elements.app.classList.add('sidebar-resizing');

    const onMove = moveEvent => this.updateSidebarResize(moveEvent);
    const onEnd = endEvent => {
      this.finishSidebarResize(endEvent);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
    };

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
  }

  updateSidebarResize(event) {
    if (!this.resizeDrag) return;
    event.preventDefault();
    const nextWidth = this.resizeDrag.startWidth + event.clientX - this.resizeDrag.startX;
    this.applySidebarWidth(nextWidth);
    this.host.reflowFloatingTocPosition();
  }

  async finishSidebarResize() {
    if (!this.resizeDrag) return;
    try {
      if (this.elements.sidebarResizer.hasPointerCapture?.(this.resizeDrag.pointerId)) {
        this.elements.sidebarResizer.releasePointerCapture(this.resizeDrag.pointerId);
      }
    } catch {
      // Pointer capture can already be released by the browser.
    }
    this.resizeDrag = null;
    this.elements.app.classList.remove('sidebar-resizing');
    await this.persistSidebarWidth();
    await nextFrame();
    this.host.reflowFloatingTocPosition();
  }

  async handleSidebarResizeKey(event) {
    const keys = new Set(['ArrowLeft', 'ArrowRight', 'Home', 'End']);
    if (!keys.has(event.key)) return;
    event.preventDefault();

    if (event.key === 'Home') {
      this.applySidebarWidth(MIN_SIDEBAR_WIDTH);
    } else if (event.key === 'End') {
      this.applySidebarWidth(MAX_SIDEBAR_WIDTH);
    } else {
      const step = event.shiftKey ? 48 : 16;
      this.applySidebarWidth(this.sidebarWidth + (event.key === 'ArrowRight' ? step : -step));
    }

    await this.persistSidebarWidth();
    this.host.reflowFloatingTocPosition();
  }

  async resetSidebarWidth() {
    this.applySidebarWidth(DEFAULT_SIDEBAR_WIDTH);
    await this.persistSidebarWidth();
    this.host.reflowFloatingTocPosition();
  }

  async restoreSidebarState() {
    const stored = await chrome.storage.local.get(SIDEBAR_COLLAPSED_KEY);
    await this.setSidebarCollapsed(Boolean(stored[SIDEBAR_COLLAPSED_KEY]), { persist: false });
  }

  async setSidebarCollapsed(collapsed, options = {}) {
    const shouldPersist = options.persist !== false;
    const wasCollapsed = this.sidebarCollapsed;
    this.sidebarCollapsed = Boolean(collapsed);
    this.elements.app.classList.toggle('sidebar-collapsed', this.sidebarCollapsed);
    this.elements.sidebarToggle.hidden = this.sidebarCollapsed;
    this.elements.sidebarRestore.tabIndex = this.sidebarCollapsed ? 0 : -1;
    this.elements.sidebarRestore.setAttribute('aria-hidden', String(!this.sidebarCollapsed));
    this.elements.sidebarResizer.setAttribute('aria-hidden', String(this.sidebarCollapsed));
    this.elements.sidebarResizer.tabIndex = this.sidebarCollapsed ? -1 : 0;
    this.elements.sidebarToggle.setAttribute('aria-expanded', String(!this.sidebarCollapsed));
    this.elements.sidebarToggle.setAttribute('aria-label', t('a11yHideSidebar'));
    this.elements.sidebarToggle.title = t('a11yHideSidebar');
    this.elements.sidebarRestore.setAttribute('aria-expanded', String(!this.sidebarCollapsed));
    this.elements.sidebarRestore.setAttribute('aria-label', t('a11yShowSidebar'));
    this.elements.sidebarRestore.title = t('a11yShowSidebar');
    // When collapsed, `.sidebar-body` is display:none in every theme, which
    // already hides it from the a11y tree and focus order; an explicit
    // aria-hidden is redundant and Chrome blocks it if focus is still inside.

    if (shouldPersist) {
      await chrome.storage.local.set({ [SIDEBAR_COLLAPSED_KEY]: this.sidebarCollapsed });
    }

    await nextFrame();
    this.host.updateFloatingOutlineState({ openPopover: !wasCollapsed && this.sidebarCollapsed });
  }
}
