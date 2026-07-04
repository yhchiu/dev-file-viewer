import { t } from '../../core/i18n/i18n.js';
import { getFileIcon, getPinIcon, getPinFilledIcon } from '../../core/ui/icons.js';

// Bounds of the pinned vs. unpinned group within the tab order. A tab may only
// be reordered within its own group. Pure over a tabs array for testability.
export function fileTabGroupBounds(tabs, pinned) {
  const firstUnpinnedIndex = tabs.findIndex(tab => !tab.pinned);
  if (pinned) {
    return { start: 0, end: firstUnpinnedIndex === -1 ? tabs.length : firstUnpinnedIndex };
  }

  return {
    start: firstUnpinnedIndex === -1 ? tabs.length : firstUnpinnedIndex,
    end: tabs.length
  };
}

// Owns the open file tabs: their order/pinning, the tab strip rendering and its
// overflow scrolling, drag-to-reorder, and per-tab runtime scroll. Calls back to
// the host to render/activate documents and to clear the viewer.
export class FileTabsController {
  constructor(host) {
    this.host = host;
    this.elements = host.elements;
    this.openTabs = [];
    this.openTabsByKey = new Map();
    this.activeTabKey = '';
    this.fileTabDrag = null;
    this.fileTabsOverflowFrame = 0;
    this.fileTabsScrollAnimationFrame = 0;
    this.ignoreNextFileTabClick = false;
  }

  bindEvents() {
    this.elements.fileTabsScrollLeft?.addEventListener('click', () => this.scrollFileTabs(-1));
    this.elements.fileTabsScrollRight?.addEventListener('click', () => this.scrollFileTabs(1));
    this.elements.fileTabsList?.addEventListener(
      'scroll',
      () => this.updateFileTabsOverflowState(),
      {
        passive: true
      }
    );
    this.elements.fileTabsViewport?.addEventListener(
      'wheel',
      event => this.handleFileTabsWheel(event),
      { passive: false }
    );
  }

  async closeFileTab(key = this.activeTabKey) {
    const tabKey = key || this.host.currentDocKey;
    const tabIndex = this.openTabs.findIndex(tab => tab.key === tabKey);
    if (tabIndex < 0) return;

    const wasActive = tabKey === this.activeTabKey;
    if (wasActive && this.host.currentDoc) {
      this.saveActiveTabRuntimeScroll();
      await this.host.scrollMemory.saveCurrentScrollPosition();
    }

    this.openTabs.splice(tabIndex, 1);
    this.openTabsByKey.delete(tabKey);

    if (!this.openTabs.length) {
      this.host.clearViewerForNoDocument();
      this.host.setStatus(t('statusNoDocumentLoaded'), 'info');
      return;
    }

    if (!wasActive) {
      this.renderFileTabs();
      return;
    }

    const nextTab = this.openTabs[Math.min(tabIndex, this.openTabs.length - 1)];
    this.renderFileTabs();
    await this.activateFileTab(nextTab.key);
  }

  clearAllFileTabs() {
    this.openTabs = [];
    this.openTabsByKey.clear();
    this.activeTabKey = '';
    this.fileTabDrag = null;
    this.ignoreNextFileTabClick = false;
    if (this.fileTabsOverflowFrame) {
      cancelAnimationFrame(this.fileTabsOverflowFrame);
      this.fileTabsOverflowFrame = 0;
    }
    this.cancelFileTabsScrollAnimation();
    this.elements.fileTabs?.classList.remove('is-tab-dragging');
    this.renderFileTabs();
  }

  upsertFileTab(doc, key = this.host.getDocumentKey(doc)) {
    if (!key) return null;

    let tab = this.openTabsByKey.get(key);
    if (!tab) {
      tab = {
        key,
        doc,
        title: this.getFileTabTitle(doc),
        sourceLabel: this.host.getDocumentSourceLabel(doc),
        pinned: false,
        scrollTop: null,
        viewMode: 'rendered'
      };
      this.openTabs.push(tab);
      this.openTabsByKey.set(key, tab);
    } else {
      tab.doc = doc;
      tab.title = this.getFileTabTitle(doc);
      tab.sourceLabel = this.host.getDocumentSourceLabel(doc);
    }

    this.activeTabKey = key;
    this.renderFileTabs();
    this.scrollActiveFileTabIntoView();
    return tab;
  }

  activateRenderedDocument(doc, key = this.host.getDocumentKey(doc)) {
    this.host.currentDoc = doc;
    this.host.currentDocKey = key;
    this.upsertFileTab(doc, key);
    this.host.setDocumentReloadEnabled(true);

    if (doc.sourceType === 'directory-file' && doc.path) {
      this.host.directoryTree.markActivePath(doc.path);
    }
  }

  getFileTabTitle(doc) {
    return doc?.name || t('docTitleUntitled');
  }

  // Per-tab Markdown preview mode ('rendered' | 'source'). Defaults to
  // 'rendered' for tabs not yet tracked (e.g. a first-time render).
  getViewMode(key) {
    return this.openTabsByKey.get(key)?.viewMode || 'rendered';
  }

  setViewMode(key, mode) {
    const tab = this.openTabsByKey.get(key);
    if (tab) tab.viewMode = mode;
  }

  saveActiveTabRuntimeScroll() {
    const tabKey = this.activeTabKey || this.host.currentDocKey;
    const tab = this.openTabsByKey.get(tabKey);
    if (!tab) return;
    tab.scrollTop = this.host.scrollRoot.scrollTop;
  }

  getRuntimeScrollTopForDocument(key, options = {}) {
    if (Number.isFinite(options.scrollTop)) return options.scrollTop;
    if (options.anchor) return null;

    const tab = this.openTabsByKey.get(key);
    return Number.isFinite(tab?.scrollTop) ? tab.scrollTop : null;
  }

  async activateFileTab(key) {
    const tab = this.openTabsByKey.get(key);
    if (!tab) return;
    if (key === this.activeTabKey && this.host.currentDoc) {
      this.scrollActiveFileTabIntoView();
      return;
    }

    await this.host.renderDocument(tab.doc, {
      scrollTop: Number.isFinite(tab.scrollTop) ? tab.scrollTop : null,
      suppressLoading: true
    });
  }

  toggleFileTabPinned(key) {
    const tab = this.openTabsByKey.get(key);
    if (!tab) return;

    this.removeFileTabFromOrder(key);
    tab.pinned = !tab.pinned;
    this.insertFileTabAtGroupBoundary(tab);
    this.renderFileTabs();
    this.scrollActiveFileTabIntoView();
  }

  removeFileTabFromOrder(key) {
    const index = this.openTabs.findIndex(tab => tab.key === key);
    if (index >= 0) this.openTabs.splice(index, 1);
  }

  insertFileTabAtGroupBoundary(tab) {
    const firstUnpinnedIndex = this.openTabs.findIndex(item => !item.pinned);
    const insertIndex = firstUnpinnedIndex === -1 ? this.openTabs.length : firstUnpinnedIndex;
    this.openTabs.splice(insertIndex, 0, tab);
  }

  renderFileTabs() {
    const { fileTabs, fileTabsList } = this.elements;
    if (!fileTabs || !fileTabsList) return;

    fileTabs.hidden = this.openTabs.length === 0;
    fileTabsList.replaceChildren();
    if (!this.openTabs.length) {
      this.updateFileTabsOverflowState();
      return;
    }

    for (const tab of this.openTabs) {
      const active = tab.key === this.activeTabKey;
      const title = tab.sourceLabel || tab.title;
      const tabElement = document.createElement('div');
      tabElement.className = 'file-tab';
      tabElement.dataset.tabKey = tab.key;
      tabElement.setAttribute('role', 'tab');
      tabElement.setAttribute('aria-selected', String(active));
      tabElement.tabIndex = active ? 0 : -1;
      tabElement.title = title;
      tabElement.classList.toggle('is-active', active);
      tabElement.classList.toggle('is-pinned', tab.pinned);
      tabElement.classList.toggle(
        'is-dragging',
        this.fileTabDrag?.key === tab.key && this.fileTabDrag.moved
      );
      tabElement.addEventListener('click', event => this.handleFileTabClick(event, tab.key));
      tabElement.addEventListener('keydown', event => this.handleFileTabKeydown(event, tab.key));
      tabElement.addEventListener('pointerdown', event => this.startFileTabDrag(event, tab.key));

      const icon = document.createElement('span');
      icon.className = 'file-tab-icon';
      // eslint-disable-next-line no-unsanitized/property -- trusted static SVG icon
      icon.innerHTML = getFileIcon('button-icon');

      const name = document.createElement('span');
      name.className = 'file-tab-name';
      name.textContent = tab.title;

      const pinButton = document.createElement('button');
      pinButton.className = 'file-tab-pin';
      pinButton.type = 'button';
      pinButton.setAttribute('aria-pressed', String(tab.pinned));
      pinButton.setAttribute(
        'aria-label',
        tab.pinned ? t('a11yUnpinFileTab') : t('a11yPinFileTab')
      );
      pinButton.title = pinButton.getAttribute('aria-label');
      // eslint-disable-next-line no-unsanitized/property -- trusted static SVG icon
      pinButton.innerHTML = tab.pinned
        ? getPinFilledIcon('button-icon')
        : getPinIcon('button-icon');
      pinButton.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        this.toggleFileTabPinned(tab.key);
      });

      const closeButton = document.createElement('button');
      closeButton.className = 'file-tab-close';
      closeButton.type = 'button';
      closeButton.setAttribute('aria-label', t('a11yCloseFileTab'));
      closeButton.title = t('a11yCloseFileTab');
      closeButton.textContent = '×';
      closeButton.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        this.closeFileTab(tab.key).catch(error => {
          this.host.clearViewerLoading();
          this.host.setStatus(this.host.getLoadErrorMessage(error), 'error');
        });
      });

      tabElement.append(icon, name, pinButton, closeButton);
      fileTabsList.append(tabElement);
    }

    this.scheduleUpdateFileTabsOverflowState();
  }

  handleFileTabClick(event, key) {
    if (this.ignoreNextFileTabClick) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }

    this.activateFileTab(key).catch(error => {
      this.host.clearViewerLoading();
      this.host.setStatus(this.host.getLoadErrorMessage(error), 'error');
    });
  }

  handleFileTabKeydown(event, key) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.activateFileTab(key).catch(error => {
        this.host.clearViewerLoading();
        this.host.setStatus(this.host.getLoadErrorMessage(error), 'error');
      });
      return;
    }

    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      this.closeFileTab(key).catch(error => {
        this.host.clearViewerLoading();
        this.host.setStatus(this.host.getLoadErrorMessage(error), 'error');
      });
      return;
    }

    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      this.focusAdjacentFileTab(key, event.key === 'ArrowLeft' ? -1 : 1);
    }
  }

  focusAdjacentFileTab(key, direction) {
    if (!this.openTabs.length) return;
    const currentIndex = this.openTabs.findIndex(tab => tab.key === key);
    if (currentIndex < 0) return;
    const nextIndex = (currentIndex + direction + this.openTabs.length) % this.openTabs.length;
    this.focusFileTab(this.openTabs[nextIndex].key);
  }

  focusFileTab(key) {
    const tabElement = Array.from(
      this.elements.fileTabsList?.querySelectorAll('.file-tab') || []
    ).find(element => element.dataset.tabKey === key);
    tabElement?.focus();
  }

  scrollActiveFileTabIntoView() {
    requestAnimationFrame(() => {
      const activeTab = this.elements.fileTabsList?.querySelector('.file-tab.is-active');
      activeTab?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
      this.updateFileTabsOverflowState();
    });
  }

  scheduleUpdateFileTabsOverflowState() {
    if (this.fileTabsOverflowFrame) return;
    this.fileTabsOverflowFrame = requestAnimationFrame(() => {
      this.fileTabsOverflowFrame = 0;
      this.updateFileTabsOverflowState();
    });
  }

  updateFileTabsOverflowState() {
    const { fileTabs, fileTabsList, fileTabsScrollLeft, fileTabsScrollRight } = this.elements;
    if (!fileTabs || !fileTabsList) return;

    const maxScrollLeft = Math.max(0, fileTabsList.scrollWidth - fileTabsList.clientWidth);
    const hasOverflow = !fileTabs.hidden && maxScrollLeft > 1;
    const canScrollLeft = hasOverflow && fileTabsList.scrollLeft > 1;
    const canScrollRight = hasOverflow && fileTabsList.scrollLeft < maxScrollLeft - 1;

    fileTabs.classList.toggle('has-overflow', hasOverflow);
    fileTabs.classList.toggle('can-scroll-left', canScrollLeft);
    fileTabs.classList.toggle('can-scroll-right', canScrollRight);

    if (fileTabsScrollLeft) {
      fileTabsScrollLeft.hidden = !hasOverflow;
      fileTabsScrollLeft.disabled = !canScrollLeft;
    }

    if (fileTabsScrollRight) {
      fileTabsScrollRight.hidden = !hasOverflow;
      fileTabsScrollRight.disabled = !canScrollRight;
    }
  }

  scrollFileTabs(direction) {
    const scroller = this.elements.fileTabsList;
    if (!scroller) return;
    const amount = Math.max(240, Math.floor(scroller.clientWidth * 0.92));
    const maxScrollLeft = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    const nextLeft = Math.max(0, Math.min(maxScrollLeft, scroller.scrollLeft + direction * amount));
    this.animateFileTabsScroll(nextLeft);
  }

  cancelFileTabsScrollAnimation() {
    if (!this.fileTabsScrollAnimationFrame) return;
    cancelAnimationFrame(this.fileTabsScrollAnimationFrame);
    this.fileTabsScrollAnimationFrame = 0;
  }

  animateFileTabsScroll(targetLeft) {
    const scroller = this.elements.fileTabsList;
    if (!scroller) return;

    this.cancelFileTabsScrollAnimation();

    const startLeft = scroller.scrollLeft;
    const distance = targetLeft - startLeft;
    if (Math.abs(distance) < 1) {
      scroller.scrollLeft = targetLeft;
      this.updateFileTabsOverflowState();
      return;
    }

    if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) {
      scroller.scrollLeft = targetLeft;
      this.updateFileTabsOverflowState();
      return;
    }

    const duration = 360;
    const startTime = performance.now();
    const easeOutCubic = progress => 1 - Math.pow(1 - progress, 3);

    const step = now => {
      const progress = Math.min(1, (now - startTime) / duration);
      scroller.scrollLeft = startLeft + distance * easeOutCubic(progress);
      this.updateFileTabsOverflowState();

      if (progress < 1) {
        this.fileTabsScrollAnimationFrame = requestAnimationFrame(step);
        return;
      }

      this.fileTabsScrollAnimationFrame = 0;
      scroller.scrollLeft = targetLeft;
      this.updateFileTabsOverflowState();
    };

    this.fileTabsScrollAnimationFrame = requestAnimationFrame(step);
  }

  handleFileTabsWheel(event) {
    const scroller = this.elements.fileTabsList;
    if (!scroller) return;

    const maxScrollLeft = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
    if (maxScrollLeft <= 1) return;

    const dominantDelta =
      Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (!dominantDelta) return;

    event.preventDefault();
    this.cancelFileTabsScrollAnimation();
    scroller.scrollLeft = Math.max(0, Math.min(maxScrollLeft, scroller.scrollLeft + dominantDelta));
    this.updateFileTabsOverflowState();
  }

  startFileTabDrag(event, key) {
    if (event.button !== 0 || event.target.closest('button')) return;
    const tab = this.openTabsByKey.get(key);
    if (!tab) return;

    this.fileTabDrag = {
      key,
      pinned: tab.pinned,
      startX: event.clientX,
      startY: event.clientY,
      moved: false,
      visual: null,
      targetIndex: -1
    };

    const onMove = moveEvent => this.updateFileTabDrag(moveEvent);
    const onEnd = endEvent => {
      this.finishFileTabDrag(endEvent);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
    };

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
  }

  updateFileTabDrag(event) {
    const drag = this.fileTabDrag;
    if (!drag) return;

    const distance = Math.abs(event.clientX - drag.startX) + Math.abs(event.clientY - drag.startY);
    if (!drag.moved && distance <= 4) return;

    if (!drag.moved) {
      drag.moved = true;
      this.elements.fileTabs?.classList.add('is-tab-dragging');
      this.beginFileTabDragVisual(drag);
    }

    event.preventDefault();
    this.updateFileTabDragVisual(drag, event.clientX);
  }

  // Snapshot the dragged tab and its same-group neighbours once, so pointer moves
  // only write transforms (no re-render, no forced reflow). Uses layout offsets
  // (unaffected by transforms) for placement and viewport centres for hit-testing.
  beginFileTabDragVisual(drag) {
    const list = this.elements.fileTabsList;
    if (!list) return;

    const groupTab = this.openTabsByKey.get(drag.key);
    const items = Array.from(list.querySelectorAll('.file-tab[data-tab-key]'))
      .map(el => ({ el, key: el.dataset.tabKey }))
      .filter(item => this.openTabsByKey.get(item.key)?.pinned === groupTab?.pinned)
      .map(item => {
        const rect = item.el.getBoundingClientRect();
        return {
          ...item,
          centerX: rect.left + rect.width / 2,
          offsetLeft: item.el.offsetLeft,
          width: item.el.offsetWidth
        };
      });

    const homeIndex = items.findIndex(item => item.key === drag.key);
    if (homeIndex < 0) return;

    const advance = items.length > 1 ? items[1].offsetLeft - items[0].offsetLeft : items[0].width;
    const gap = Math.max(0, advance - items[0].width);

    let indicator = null;
    if (items.length > 1) {
      indicator = document.createElement('div');
      indicator.className = 'file-tab-drop-indicator';
      indicator.setAttribute('aria-hidden', 'true');
      list.append(indicator);
    }

    const draggedEl = items[homeIndex].el;
    draggedEl.classList.add('is-dragging');

    drag.visual = { list, items, homeIndex, advance, gap, indicator, draggedEl };
  }

  updateFileTabDragVisual(drag, clientX) {
    const visual = drag.visual;
    if (!visual) return;

    const { items, homeIndex, advance, gap, indicator, draggedEl } = visual;
    const dx = clientX - drag.startX;
    draggedEl.style.transform = `translateX(${dx}px) scale(1.03)`;

    // Final group slot the dragged tab would occupy = how many other tabs sit
    // to its left, measured against their original (pre-transform) centres.
    let targetIndex = 0;
    for (let i = 0; i < items.length; i += 1) {
      if (i !== homeIndex && items[i].centerX < clientX) targetIndex += 1;
    }
    drag.targetIndex = targetIndex;

    for (let i = 0; i < items.length; i += 1) {
      if (i === homeIndex) continue;
      let shift = 0;
      if (targetIndex > homeIndex && i > homeIndex && i <= targetIndex) shift = -advance;
      else if (targetIndex < homeIndex && i >= targetIndex && i < homeIndex) shift = advance;
      items[i].el.style.transform = shift ? `translateX(${shift}px)` : '';
    }

    if (indicator) {
      const left = items[0].offsetLeft + targetIndex * advance - gap / 2;
      indicator.style.left = `${left}px`;
    }
  }

  finishFileTabDrag(event) {
    const drag = this.fileTabDrag;
    const moved = Boolean(drag?.moved);
    this.fileTabDrag = null;
    this.elements.fileTabs?.classList.remove('is-tab-dragging');

    if (moved) {
      if (drag.visual && drag.targetIndex >= 0) {
        this.commitFileTabDrag(drag.key, drag.pinned, drag.targetIndex);
      }
      // renderFileTabs() rebuilds the strip, discarding the drag's inline
      // transforms and the drop indicator in one shot.
      this.renderFileTabs();
      event.preventDefault();
      this.ignoreNextFileTabClick = true;
      window.setTimeout(() => {
        this.ignoreNextFileTabClick = false;
      }, 250);
      return;
    }

    this.updateFileTabsOverflowState();
  }

  // Reorder the model to match where the drag settled. targetIndex is the final
  // slot within the pinned/unpinned group; the group's offset anchors it into
  // the full openTabs order.
  commitFileTabDrag(key, pinned, targetIndex) {
    const fromIndex = this.openTabs.findIndex(tab => tab.key === key);
    if (fromIndex < 0) return;

    const { start } = fileTabGroupBounds(this.openTabs, pinned);
    if (fromIndex === start + targetIndex) return;

    const [tab] = this.openTabs.splice(fromIndex, 1);
    this.openTabs.splice(start + targetIndex, 0, tab);
  }
}
