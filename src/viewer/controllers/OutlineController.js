import { t } from '../../core/i18n/i18n.js';
import { buildHeadingIndex, buildHeadingTree } from '../../core/toc/headingIndex.js';
import { buildDiffOutlineTree } from '../../core/diff/diffOutlineTree.js';
import { buildSourceSymbolTree, extractSourceSymbols } from '../../core/source/sourceSymbols.js';
import { symbolKindLabel } from '../../core/source/symbolLabels.js';
import { getArrowRightIcon, getFolderClosedIcon, getFileIcon } from '../../core/ui/icons.js';
import { immediateParentId } from '../viewerHelpers.js';

const TOC_POPOVER_PINNED_KEY = 'devFileViewer:tocPopoverPinned';
const TOC_FILTER_THRESHOLD = 12;
const DEFAULT_TOC_MAX_LEVEL = 3;
const TOC_DEPTH_LEVELS = new Set([2, 3, 4, 5, 6]);

// Clamp a position into [minLeft..maxRight-width] x [minTop..maxBottom-height].
// Pure geometry split out of the DOM-reading clampFloatingTocPosition().
export function clampToBounds(position, bounds, size) {
  const maxLeft = Math.max(bounds.minLeft, bounds.maxRight - size.width);
  const maxTop = Math.max(bounds.minTop, bounds.maxBottom - size.height);
  return {
    left: Math.min(Math.max(Number(position.left) || bounds.minLeft, bounds.minLeft), maxLeft),
    top: Math.min(Math.max(Number(position.top) || bounds.minTop, bounds.minTop), maxTop)
  };
}

// Recursively collect all descendant ids of a tree node into targetSet.
export function collectDescendantIds(node, targetSet) {
  if (!node?.children?.length) return;
  for (const child of node.children) {
    targetSet.add(child.id);
    collectDescendantIds(child, targetSet);
  }
}

function tocIconSvg(kind) {
  if (kind === 'folder') {
    return getFolderClosedIcon('toc-item-icon toc-folder-icon');
  }

  return getFileIcon('toc-item-icon toc-file-icon');
}

// Owns the document outline: the table of contents (markdown headings, diff
// files, source symbols), its filtering/active-heading tracking, and the
// floating outline button + popover. Calls back to the host to scroll, save
// scroll position, highlight source lines, and read sidebar/drop state.
export class OutlineController {
  constructor(host) {
    this.host = host;
    this.elements = host.elements;
    this.outlineType = 'markdown';
    this.headings = [];
    this.headingTree = { nodes: [], roots: [], byId: new Map() };
    this.tocCollapsedIds = new Set();
    this.tocItems = new Map();
    this.activeHeadingId = '';
    this.activeHeadingFrame = 0;
    this.tocFilterQuery = '';
    this.tocMaxLevel = DEFAULT_TOC_MAX_LEVEL;
    this.tocPopoverOpen = false;
    this.tocPopoverPinned = false;
    this.outlinePopoutEnabled = false;
    this.floatingTocPosition = null;
    this.floatingOutlineDrag = null;
    this.ignoreNextFloatingOutlineClick = false;
  }

  async restore() {
    await this.restoreTocPopoverPinState();
  }

  bindEvents() {
    this.elements.floatingOutline.addEventListener('pointerdown', event =>
      this.startFloatingOutlineDrag(event)
    );
    this.elements.floatingOutline.addEventListener('click', event => {
      if (this.ignoreNextFloatingOutlineClick) {
        event.preventDefault();
        event.stopPropagation();
        this.ignoreNextFloatingOutlineClick = false;
        this.host.drop.dragDepth = 0;
        return;
      }
      this.toggleTocPopover();
    });
    this.elements.closeTocPopover.addEventListener('click', () =>
      this.closeTocPopover({ force: true })
    );
    this.elements.pinTocPopover.addEventListener('click', () =>
      this.setTocPopoverPinned(!this.tocPopoverPinned)
    );
    this.elements.popoutOutline.addEventListener('click', () => this.toggleOutlinePopout());
    this.elements.tocDepth.addEventListener('change', () =>
      this.setTocDepth(this.elements.tocDepth.value)
    );
    this.elements.tocPopoverDepth.addEventListener('change', () =>
      this.setTocDepth(this.elements.tocPopoverDepth.value)
    );
    this.elements.tocFilter.addEventListener('input', () =>
      this.setTocFilter(this.elements.tocFilter.value)
    );
    this.elements.tocPopoverFilter.addEventListener('input', () =>
      this.setTocFilter(this.elements.tocPopoverFilter.value)
    );
    document.addEventListener('keydown', event => this.handleGlobalKeydown(event));
    document.addEventListener('pointerdown', event => this.handleDocumentPointerDown(event));
  }

  handleGlobalKeydown(event) {
    if (event.key === 'Escape' && this.tocPopoverOpen && !this.tocPopoverPinned) {
      event.preventDefault();
      this.closeTocPopover();
    }
  }

  handleDocumentPointerDown(event) {
    if (!this.tocPopoverOpen || this.tocPopoverPinned) return;
    const target = event.target;
    if (this.elements.tocPopover.contains(target) || this.elements.floatingOutline.contains(target))
      return;
    this.closeTocPopover();
  }

  /* ---------- Floating outline button + popover ---------- */

  toggleTocPopover() {
    if (this.tocPopoverOpen) this.closeTocPopover({ force: true });
    else this.openTocPopover();
  }

  openTocPopover(options = {}) {
    if (!this.headings.length) return;
    this.tocPopoverOpen = true;
    this.elements.tocPopover.hidden = false;
    this.elements.floatingOutline.setAttribute('aria-expanded', 'true');
    this.updateOutlinePopoutControl();
    this.updateFloatingTocPopoverPosition();
    this.setActiveHeading(this.activeHeadingId || this.headings[0]?.id || '');

    if (options.focus === false) return;
    requestAnimationFrame(() => {
      if (!this.tocPopoverOpen) return;
      if (!this.elements.tocPopoverFilterRow.hidden) this.elements.tocPopoverFilter.focus();
      else this.elements.tocPopover.querySelector('.toc-item:not([hidden])')?.focus();
    });
  }

  closeTocPopover() {
    this.tocPopoverOpen = false;
    this.elements.tocPopover.hidden = true;
    this.elements.floatingOutline.setAttribute('aria-expanded', 'false');
    this.updateOutlinePopoutControl();
  }

  updateFloatingOutlineState(options = {}) {
    const hasHeadings = this.headings.length > 0;
    if (!hasHeadings) {
      this.outlinePopoutEnabled = false;
    }

    const shouldShow =
      hasHeadings &&
      (this.host.sidebar.sidebarCollapsed || this.tocPopoverPinned || this.outlinePopoutEnabled);
    const wasFloatingHidden = this.elements.floatingOutline.hidden;
    this.elements.floatingOutline.hidden = !shouldShow;
    this.updateOutlinePopoutControl();

    if (!shouldShow) {
      this.closeTocPopover();
      return;
    }

    this.reflowFloatingTocPosition();
    const shouldAutoOpen =
      options.openPopover || (this.host.sidebar.sidebarCollapsed && wasFloatingHidden);
    if ((this.tocPopoverPinned || shouldAutoOpen) && !this.tocPopoverOpen) {
      this.openTocPopover({ focus: false });
    }
  }

  toggleOutlinePopout() {
    if (!this.headings.length) return;

    if (this.tocPopoverPinned) {
      this.openTocPopover({ focus: false });
      this.updateOutlinePopoutControl();
      return;
    }

    if (this.outlinePopoutEnabled) {
      this.outlinePopoutEnabled = false;
      this.closeTocPopover({ force: true });
      this.updateFloatingOutlineState();
      return;
    }

    this.outlinePopoutEnabled = true;
    this.updateFloatingOutlineState();
    this.openTocPopover({ focus: false });
  }

  updateOutlinePopoutControl() {
    const button = this.elements.popoutOutline;
    if (!button) return;

    const hasHeadings = this.headings.length > 0;
    const floatingVisible = !this.elements.floatingOutline.hidden;
    button.disabled = !hasHeadings;
    button.classList.toggle('is-active', hasHeadings && floatingVisible);
    button.setAttribute('aria-pressed', String(hasHeadings && floatingVisible));

    if (!hasHeadings) {
      button.title = t('popoutNoHeadings');
      button.setAttribute('aria-label', t('popoutNoHeadings'));
    } else if (this.tocPopoverPinned) {
      button.title = t('a11yFloatingOutlinePinned');
      button.setAttribute('aria-label', t('a11yFloatingOutlinePinned'));
    } else if (this.outlinePopoutEnabled) {
      button.title = t('a11yHideFloatingOutline');
      button.setAttribute('aria-label', t('a11yHideFloatingOutline'));
    } else {
      button.title = t('a11yPopOutOutline');
      button.setAttribute('aria-label', t('a11yPopOutOutline'));
    }
  }

  async restoreTocPopoverPinState() {
    const stored = await chrome.storage.local.get(TOC_POPOVER_PINNED_KEY);
    this.applyTocPopoverPinned(Boolean(stored[TOC_POPOVER_PINNED_KEY]));
  }

  async setTocPopoverPinned(pinned) {
    this.applyTocPopoverPinned(Boolean(pinned));
    await chrome.storage.local.set({ [TOC_POPOVER_PINNED_KEY]: this.tocPopoverPinned });
    this.updateFloatingOutlineState();
  }

  applyTocPopoverPinned(pinned) {
    this.tocPopoverPinned = Boolean(pinned);
    this.elements.app.classList.toggle('toc-popover-pinned', this.tocPopoverPinned);
    this.elements.pinTocPopover.classList.toggle('is-active', this.tocPopoverPinned);
    this.elements.pinTocPopover.setAttribute('aria-pressed', String(this.tocPopoverPinned));
    this.elements.pinTocPopover.title = this.tocPopoverPinned
      ? t('a11yUnpinOutlinePopover')
      : t('a11yPinOutlinePopover');
    this.elements.pinTocPopover.setAttribute('aria-label', this.elements.pinTocPopover.title);
    this.updateOutlinePopoutControl();
  }

  startFloatingOutlineDrag(event) {
    if (event.button !== 0) return;
    const startPosition = this.getFloatingTocPosition();
    this.floatingOutlineDrag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startLeft: startPosition.left,
      startTop: startPosition.top,
      moved: false
    };
    this.elements.floatingOutline.setPointerCapture(event.pointerId);
    this.elements.floatingOutline.classList.add('is-dragging');

    const onMove = moveEvent => this.updateFloatingOutlineDrag(moveEvent);
    const onEnd = endEvent => {
      this.finishFloatingOutlineDrag(endEvent);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
    };

    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
  }

  updateFloatingOutlineDrag(event) {
    if (!this.floatingOutlineDrag) return;
    const dx = event.clientX - this.floatingOutlineDrag.startX;
    const dy = event.clientY - this.floatingOutlineDrag.startY;
    if (Math.abs(dx) + Math.abs(dy) > 4) this.floatingOutlineDrag.moved = true;
    if (!this.floatingOutlineDrag.moved) return;
    event.preventDefault();
    this.applyFloatingTocPosition({
      left: this.floatingOutlineDrag.startLeft + dx,
      top: this.floatingOutlineDrag.startTop + dy
    });
  }

  finishFloatingOutlineDrag(event) {
    if (!this.floatingOutlineDrag) return;
    const moved = this.floatingOutlineDrag.moved;
    try {
      if (this.elements.floatingOutline.hasPointerCapture?.(this.floatingOutlineDrag.pointerId)) {
        this.elements.floatingOutline.releasePointerCapture(this.floatingOutlineDrag.pointerId);
      }
    } catch {
      // Pointer capture can already be released by the browser.
    }
    this.floatingOutlineDrag = null;
    this.elements.floatingOutline.classList.remove('is-dragging');
    if (moved) {
      event.preventDefault();
      this.ignoreNextFloatingOutlineClick = true;
      window.setTimeout(() => {
        this.ignoreNextFloatingOutlineClick = false;
        this.host.drop.dragDepth = 0;
      }, 250);
    }
  }

  reflowFloatingTocPosition() {
    if (this.elements.floatingOutline.hidden) return;

    if (this.floatingTocPosition) {
      this.applyFloatingTocPosition(this.floatingTocPosition);
      return;
    }

    this.applyDefaultFloatingTocPosition();
  }

  getFloatingTocPosition() {
    if (this.floatingTocPosition) return this.clampFloatingTocPosition(this.floatingTocPosition);
    const rect = this.elements.floatingOutline.getBoundingClientRect();
    return this.clampFloatingTocPosition({ left: rect.left, top: rect.top });
  }

  getDefaultFloatingTocPosition() {
    const viewerRect = this.elements.viewerMain.getBoundingClientRect();
    const previewRect = this.elements.preview.getBoundingClientRect();
    const statusEl = this.elements.status;
    const statusRect = statusEl && !statusEl.hidden ? statusEl.getBoundingClientRect() : null;
    const padding = 16;
    const buttonRect = this.elements.floatingOutline.getBoundingClientRect();
    const buttonWidth = buttonRect.width || 92;
    const buttonHeight = buttonRect.height || 38;

    // Right edge of the centered content column (the status section shares this width).
    const contentRight = previewRect.width > 0 ? previewRect.right : viewerRect.right;
    const left = contentRight - padding - buttonWidth;

    let top;
    if (statusRect && statusRect.height > 0) {
      // Sit to the right of the status section, vertically centered on it.
      top = statusRect.top + (statusRect.height - buttonHeight) / 2;
    } else if (previewRect.width > 0) {
      // No status visible: fall back to the top of the preview, clearing the header.
      top = Math.max(viewerRect.top + 80, previewRect.top + 12);
    } else {
      // Fallback if preview is not yet sized/rendered.
      top = viewerRect.top + 80;
    }

    return this.clampFloatingTocPosition({ left, top });
  }

  applyDefaultFloatingTocPosition() {
    const position = this.getDefaultFloatingTocPosition();
    this.applyFloatingTocPosition(position, { remember: false });
  }

  applyFloatingTocPosition(position, options = {}) {
    const nextPosition = this.clampFloatingTocPosition(position);
    if (options.remember === false) {
      this.floatingTocPosition = null;
    } else {
      this.floatingTocPosition = nextPosition;
    }

    this.elements.floatingOutline.style.left = `${nextPosition.left}px`;
    this.elements.floatingOutline.style.top = `${nextPosition.top}px`;
    this.elements.floatingOutline.style.right = 'auto';
    this.elements.floatingOutline.style.bottom = 'auto';
    this.updateFloatingTocPopoverPosition();
  }

  getFloatingTocBounds() {
    const padding = 8;
    const viewerRect = this.elements.viewerMain.getBoundingClientRect();
    const minLeft = Math.max(padding, Math.round(viewerRect.left + padding));
    const minTop = Math.max(padding, Math.round(viewerRect.top + padding));

    return {
      padding,
      minLeft,
      minTop,
      maxRight: Math.max(minLeft, window.innerWidth - padding),
      maxBottom: Math.max(minTop, window.innerHeight - padding)
    };
  }

  clampFloatingTocPosition(position) {
    const bounds = this.getFloatingTocBounds();
    const rect = this.elements.floatingOutline.getBoundingClientRect();
    return clampToBounds(position, bounds, { width: rect.width || 92, height: rect.height || 38 });
  }

  updateFloatingTocPopoverPosition() {
    if (this.elements.floatingOutline.hidden) return;
    const buttonRect = this.elements.floatingOutline.getBoundingClientRect();
    const popover = this.elements.tocPopover;
    const gap = 8;
    const bounds = this.getFloatingTocBounds();
    const availableWidth = Math.max(0, bounds.maxRight - bounds.minLeft);
    const popoverWidth = Math.min(360, Math.max(180, availableWidth));
    const viewportHeight = Math.max(0, bounds.maxBottom - bounds.minTop);
    const measuredHeight = Math.min(
      popover.hidden ? 480 : popover.offsetHeight || 480,
      viewportHeight || 480
    );
    const belowTop = buttonRect.bottom + gap;
    const belowSpace = Math.max(0, bounds.maxBottom - belowTop);
    const aboveSpace = Math.max(0, buttonRect.top - gap - bounds.minTop);
    const targetSpace =
      belowSpace >= Math.min(measuredHeight, 220) || belowSpace >= aboveSpace
        ? belowSpace
        : aboveSpace;
    const minHeight = Math.min(80, viewportHeight || 80);
    const popoverHeight = Math.min(measuredHeight, Math.max(minHeight, targetSpace));
    let left = buttonRect.left;
    let top = targetSpace === belowSpace ? belowTop : buttonRect.top - popoverHeight - gap;

    if (left + popoverWidth > bounds.maxRight) {
      left = Math.min(buttonRect.right - popoverWidth, bounds.maxRight - popoverWidth);
    }
    if (top < bounds.minTop) top = bounds.minTop;
    if (top + popoverHeight > bounds.maxBottom)
      top = Math.max(bounds.minTop, bounds.maxBottom - popoverHeight);
    if (left < bounds.minLeft) left = bounds.minLeft;

    popover.style.left = `${Math.round(left)}px`;
    popover.style.top = `${Math.round(top)}px`;
    popover.style.width = `${Math.round(popoverWidth)}px`;
    popover.style.maxHeight = `${Math.round(popoverHeight)}px`;
  }

  /* ---------- TOC build / render / filter / active heading ---------- */

  buildToc(options = {}) {
    this.outlineType = 'markdown';
    this.headings = buildHeadingIndex(this.elements.preview, { maxLevel: this.tocMaxLevel });
    this.headingTree = buildHeadingTree(this.headings);
    this.tocCollapsedIds = new Set();
    this.tocItems = new Map();
    this.activeHeadingId = '';
    this.tocFilterQuery = '';
    this.elements.tocTree.innerHTML = '';
    this.elements.tocPopoverTree.innerHTML = '';
    this.elements.tocFilter.value = '';
    this.elements.tocPopoverFilter.value = '';
    this.syncTocDepthControls();

    if (!this.headings.length) {
      this.renderTocEmpty(t('tocNoHeadingsFound'));
      this.elements.outlineTab.textContent = t('outline');
      this.updateTocDepthVisibility();
      this.updateTocFilterVisibility();
      this.updateFloatingOutlineState(options);
      return;
    }

    this.renderTocContainer(this.elements.tocTree, 'panel');
    this.renderTocContainer(this.elements.tocPopoverTree, 'popover');
    this.elements.outlineTab.textContent = t('outlineTabCount', [String(this.headings.length)]);
    this.updateTocDepthVisibility();
    this.updateTocFilterVisibility();
    this.applyTocFilter();
    this.updateFloatingOutlineState(options);
    this.scheduleActiveHeadingUpdate();
  }

  buildDiffOutline(files, doc, options = {}) {
    this.outlineType = 'diff';
    this.headingTree = buildDiffOutlineTree(files);
    this.headings = this.headingTree.fileNodes;
    this.tocCollapsedIds = new Set();
    this.tocItems = new Map();
    this.activeHeadingId = '';
    this.tocFilterQuery = '';
    this.elements.tocTree.innerHTML = '';
    this.elements.tocPopoverTree.innerHTML = '';
    this.elements.tocFilter.value = '';
    this.elements.tocPopoverFilter.value = '';
    this.updateTocTitle(doc, t('tocChangedFiles'));
    this.elements.tocDepthRow.hidden = true;
    this.elements.tocPopoverDepthRow.hidden = true;

    if (!this.headingTree.nodes.length) {
      this.renderTocEmpty(t('tocNoChangedFiles'));
      this.elements.outlineTab.textContent = t('tabFiles');
      this.outlinePopoutEnabled = false;
      this.updateTocFilterVisibility();
      this.updateFloatingOutlineState(options);
      return;
    }

    this.renderTocContainer(this.elements.tocTree, 'panel');
    this.renderTocContainer(this.elements.tocPopoverTree, 'popover');
    this.elements.outlineTab.textContent = t('changesTabCount', [String(this.headings.length)]);
    this.updateTocFilterVisibility();
    this.applyTocFilter();
    this.updateFloatingOutlineState(options);
    this.scheduleActiveHeadingUpdate();
  }

  buildSourceSymbols(doc, language, options = {}) {
    this.outlineType = 'source';
    const symbols = extractSourceSymbols(doc.text || '', {
      language,
      name: doc.name || doc.url || doc.path || ''
    });
    this.headingTree = buildSourceSymbolTree(symbols, this.elements.preview);
    this.headings = this.headingTree.symbolNodes;
    this.tocCollapsedIds = new Set();
    this.tocItems = new Map();
    this.activeHeadingId = '';
    this.tocFilterQuery = '';
    this.elements.tocTree.innerHTML = '';
    this.elements.tocPopoverTree.innerHTML = '';
    this.elements.tocFilter.value = '';
    this.elements.tocPopoverFilter.value = '';
    this.updateTocTitle(doc, t('symbolsTitle'));
    this.elements.tocDepthRow.hidden = true;
    this.elements.tocPopoverDepthRow.hidden = true;

    if (!this.headingTree.nodes.length) {
      this.renderTocEmpty(t('tocNoSymbols'));
      this.elements.outlineTab.textContent = t('symbolsTitle');
      this.outlinePopoutEnabled = false;
      this.updateTocFilterVisibility();
      this.updateFloatingOutlineState(options);
      return;
    }

    this.renderTocContainer(this.elements.tocTree, 'panel');
    this.renderTocContainer(this.elements.tocPopoverTree, 'popover');
    this.elements.outlineTab.textContent = t('symbolsTabCount', [String(this.headings.length)]);
    this.updateTocFilterVisibility();
    this.applyTocFilter();
    this.updateFloatingOutlineState(options);
    this.scheduleActiveHeadingUpdate();
  }

  renderTocContainer(container, context) {
    const list = document.createElement('div');
    list.className = 'toc-list toc-tree-list';
    list.dataset.tocContext = context;

    // Parent ids that have at least one expandable (chevron) child. A childless
    // heading sharing one of these parents sits among chevroned siblings, so it
    // gets a leaf dot to keep equal visual weight (see immediateParentId()).
    const parentsWithExpandableChild = new Set();
    for (const node of this.headingTree.nodes) {
      if (node.hasChildren) parentsWithExpandableChild.add(immediateParentId(node));
    }

    for (const heading of this.headingTree.nodes) {
      const row = document.createElement('div');
      row.className = `toc-row toc-level-${heading.level}`;
      row.classList.toggle('toc-kind-diff-directory', heading.kind === 'diff-directory');
      row.classList.toggle('toc-kind-diff-file', heading.kind === 'diff-file');
      row.classList.toggle('toc-kind-source-symbol', heading.kind === 'source-symbol');
      row.dataset.headingId = heading.id;
      row.dataset.parentIds = heading.parentIds.join(' ');
      row.dataset.tocText =
        `${heading.text || ''} ${heading.path || ''} ${heading.filePath || ''}`.toLowerCase();
      row.dataset.tocContext = context;

      const toggle = document.createElement('button');
      toggle.type = 'button';
      toggle.className = 'toc-disclosure';
      toggle.dataset.headingId = heading.id;
      toggle.dataset.tocContext = context;
      toggle.setAttribute('aria-label', t('a11yCollapseSection', [heading.text]));
      toggle.setAttribute('aria-expanded', 'true');
      // eslint-disable-next-line no-unsanitized/property -- trusted static SVG icon
      toggle.innerHTML = getArrowRightIcon('button-icon');
      if (!heading.hasChildren) {
        toggle.classList.add('is-placeholder');
        if (parentsWithExpandableChild.has(immediateParentId(heading))) {
          toggle.classList.add('is-mixed-leaf');
        }
        toggle.disabled = true;
        toggle.setAttribute('aria-hidden', 'true');
        toggle.removeAttribute('aria-label');
        toggle.removeAttribute('aria-expanded');
      } else {
        toggle.addEventListener('click', event => {
          event.preventDefault();
          event.stopPropagation();
          this.toggleTocGroup(heading.id);
        });
      }

      const item =
        heading.kind === 'diff-directory'
          ? document.createElement('button')
          : document.createElement('a');

      item.className = 'toc-item';
      item.dataset.tocContext = context;
      item.title = heading.path || heading.text;

      if (heading.kind === 'diff-directory') {
        item.type = 'button';
        item.classList.add('toc-directory-item');
        // eslint-disable-next-line no-unsanitized/property -- trusted static markup; label text set via textContent below
        item.innerHTML = `${tocIconSvg('folder')}<span class="toc-item-label"></span>`;
        item.querySelector('.toc-item-label').textContent = heading.text;
        item.addEventListener('click', event => {
          event.preventDefault();
          this.toggleTocGroup(heading.id);
        });
      } else if (heading.kind === 'diff-file') {
        item.href = `#${encodeURIComponent(heading.id)}`;
        // eslint-disable-next-line no-unsanitized/property -- trusted static markup; label/stats text set via textContent below
        item.innerHTML = `${tocIconSvg('file')}<span class="toc-item-label"></span><span class="toc-item-stats"></span>`;
        item.querySelector('.toc-item-label').textContent = heading.text;
        item.querySelector('.toc-item-stats').textContent =
          `+${heading.stats?.added || 0} −${heading.stats?.removed || 0}`;
        item.addEventListener('click', event => {
          event.preventDefault();
          this.host.scrollToAnchor(heading.id, { smooth: true, updateHash: true });
          this.host.scrollMemory.saveCurrentScrollPosition().catch(() => {});
          if (context === 'popover' && !this.tocPopoverPinned) this.closeTocPopover();
        });
        this.registerTocItem(heading.id, item);
      } else if (heading.kind === 'source-symbol') {
        const anchorId = heading.anchorId || `L${heading.line}`;
        item.href = `#${encodeURIComponent(anchorId)}`;
        // eslint-disable-next-line no-unsanitized/property -- trusted static markup with localized badge + numeric line; label text set via textContent below
        item.innerHTML = `<span class="toc-symbol-badge">${symbolKindLabel(heading.symbolKind)}</span><span class="toc-item-label"></span><span class="toc-symbol-line">L${heading.line}</span>`;
        item.querySelector('.toc-item-label').textContent = heading.text;
        item.addEventListener('click', event => {
          event.preventDefault();
          this.host.scrollToAnchor(anchorId, { smooth: true, updateHash: true });
          this.host.highlightSourceLine(anchorId);
          this.host.scrollMemory.saveCurrentScrollPosition().catch(() => {});
          if (context === 'popover' && !this.tocPopoverPinned) this.closeTocPopover();
        });
        this.registerTocItem(heading.id, item);
      } else {
        item.href = `#${encodeURIComponent(heading.id)}`;
        item.textContent = heading.text;
        item.addEventListener('click', event => {
          event.preventDefault();
          this.host.scrollToAnchor(heading.id, { smooth: true, updateHash: true });
          this.host.scrollMemory.saveCurrentScrollPosition().catch(() => {});
          if (context === 'popover' && !this.tocPopoverPinned) this.closeTocPopover();
        });
        this.registerTocItem(heading.id, item);
      }

      row.append(toggle, item);
      list.append(row);
    }

    const noMatch = document.createElement('div');
    noMatch.className = 'toc-empty toc-no-matches';
    noMatch.textContent =
      this.outlineType === 'diff'
        ? t('tocNoMatchingFiles')
        : this.outlineType === 'source'
          ? t('tocNoMatchingSymbols')
          : t('tocNoMatchingHeadings');
    noMatch.hidden = true;

    container.append(list, noMatch);
  }

  registerTocItem(id, item) {
    const items = this.tocItems.get(id) || [];
    items.push(item);
    this.tocItems.set(id, items);
  }

  toggleTocGroup(id) {
    const node = this.headingTree.byId.get(id);
    if (!node || !node.hasChildren) return;

    if (this.tocCollapsedIds.has(id)) this.tocCollapsedIds.delete(id);
    else this.tocCollapsedIds.add(id);

    if (this.activeHeadingId) this.expandTocAncestors(this.activeHeadingId, { apply: false });
    this.applyTocFilter();
  }

  expandTocAncestors(id, options = {}) {
    const node = this.headingTree.byId.get(id);
    if (!node || !node.parentIds.length) return false;

    let changed = false;
    for (const parentId of node.parentIds) {
      if (this.tocCollapsedIds.delete(parentId)) changed = true;
    }

    if (changed && options.apply !== false) this.applyTocFilter();
    return changed;
  }

  renderTocEmpty(message) {
    this.elements.tocTree.innerHTML = '';
    this.elements.tocPopoverTree.innerHTML = '';
    const panelEmpty = document.createElement('div');
    panelEmpty.className = 'toc-empty';
    panelEmpty.textContent = message;
    const popoverEmpty = panelEmpty.cloneNode(true);
    this.elements.tocTree.append(panelEmpty);
    this.elements.tocPopoverTree.append(popoverEmpty);
  }

  syncTocDepthControls() {
    const value = String(this.tocMaxLevel);
    if (this.elements.tocDepth.value !== value) this.elements.tocDepth.value = value;
    if (this.elements.tocPopoverDepth.value !== value) this.elements.tocPopoverDepth.value = value;
  }

  setTocDepth(value) {
    const level = Number(value);
    this.tocMaxLevel = TOC_DEPTH_LEVELS.has(level) ? level : DEFAULT_TOC_MAX_LEVEL;
    this.syncTocDepthControls();
    this.buildToc();
    this.scheduleActiveHeadingUpdate();
  }

  updateTocDepthVisibility() {
    const shouldShow = this.elements.preview.querySelectorAll('h1, h2, h3, h4, h5, h6').length > 0;
    this.elements.tocDepthRow.hidden = !shouldShow;
    this.elements.tocPopoverDepthRow.hidden = !shouldShow;
  }

  updateTocFilterVisibility() {
    const shouldShow = this.headings.length >= TOC_FILTER_THRESHOLD;
    this.elements.tocFilterRow.hidden = !shouldShow;
    this.elements.tocPopoverFilterRow.hidden = !shouldShow;
  }

  setTocFilter(value) {
    this.tocFilterQuery = String(value || '')
      .trim()
      .toLowerCase();
    if (this.elements.tocFilter.value !== value) this.elements.tocFilter.value = value;
    if (this.elements.tocPopoverFilter.value !== value)
      this.elements.tocPopoverFilter.value = value;
    this.applyTocFilter();
  }

  applyTocFilter() {
    const query = this.tocFilterQuery;
    for (const container of [this.elements.tocTree, this.elements.tocPopoverTree]) {
      const rows = Array.from(container.querySelectorAll('.toc-row'));
      let visibleCount = 0;
      const matchedIds = new Set();
      const visibleIds = new Set();

      if (query) {
        for (const row of rows) {
          if (row.dataset.tocText.includes(query)) {
            const id = row.dataset.headingId;
            matchedIds.add(id);
            visibleIds.add(id);
            const node = this.headingTree.byId.get(id);
            for (const parentId of node?.parentIds || []) visibleIds.add(parentId);
            collectDescendantIds(node, visibleIds);
          }
        }
      }

      for (const row of rows) {
        const id = row.dataset.headingId;
        const node = this.headingTree.byId.get(id);
        let hidden;

        if (query) {
          hidden = !visibleIds.has(id);
        } else {
          hidden = Boolean(node?.parentIds?.some(parentId => this.tocCollapsedIds.has(parentId)));
        }

        row.hidden = hidden;
        row.classList.toggle('is-filter-match', query && matchedIds.has(id));
        if (!hidden) visibleCount += 1;
      }

      const noMatch = container.querySelector('.toc-no-matches');
      if (noMatch) noMatch.hidden = visibleCount > 0 || rows.length === 0;
    }

    this.updateTocDisclosureStates();
  }

  updateTocDisclosureStates() {
    const query = this.tocFilterQuery;
    const matchedAncestorIds = new Set();

    if (query) {
      for (const heading of this.headingTree.nodes) {
        if (
          !`${heading.text || ''} ${heading.path || ''} ${heading.filePath || ''}`
            .toLowerCase()
            .includes(query)
        )
          continue;
        for (const parentId of heading.parentIds) matchedAncestorIds.add(parentId);
      }
    }

    for (const container of [this.elements.tocTree, this.elements.tocPopoverTree]) {
      for (const toggle of container.querySelectorAll('.toc-disclosure:not(.is-placeholder)')) {
        const id = toggle.dataset.headingId;
        const expanded = query
          ? matchedAncestorIds.has(id) || !this.tocCollapsedIds.has(id)
          : !this.tocCollapsedIds.has(id);
        toggle.setAttribute('aria-expanded', String(expanded));
        const node = this.headingTree.byId.get(id);
        toggle.setAttribute(
          'aria-label',
          t(expanded ? 'a11yCollapseSection' : 'a11yExpandSection', [
            node?.text || t('commonSection')
          ])
        );
      }
    }
  }

  clearToc() {
    this.outlineType = 'markdown';
    this.headings = [];
    this.headingTree = { nodes: [], roots: [], byId: new Map() };
    this.tocCollapsedIds = new Set();
    this.tocItems = new Map();
    this.activeHeadingId = '';
    this.tocFilterQuery = '';
    this.elements.tocFilter.value = '';
    this.elements.tocPopoverFilter.value = '';
    this.renderTocEmpty(t('tocEmptyGeneric'));
    this.elements.outlineTab.textContent = t('outline');
    this.updateTocDepthVisibility();
    this.outlinePopoutEnabled = false;
    this.updateTocFilterVisibility();
    this.updateTocTitle(null, t('tocOnThisPage'));
    this.updateFloatingOutlineState();
  }

  updateTocTitle(doc, label = t('tocOnThisPage')) {
    const name = doc?.name || '';
    for (const titleElement of [this.elements.tocTitleLabel, this.elements.tocPopoverTitleLabel]) {
      if (titleElement) titleElement.textContent = label;
    }
    for (const element of [this.elements.tocFileName, this.elements.tocPopoverFileName]) {
      if (!element) continue;
      element.textContent = name ? `(${name})` : '';
      element.title = name;
    }
  }

  scheduleActiveHeadingUpdate() {
    if (this.activeHeadingFrame) return;
    this.activeHeadingFrame = requestAnimationFrame(() => {
      this.activeHeadingFrame = 0;
      this.updateActiveHeading();
    });
  }

  updateActiveHeading() {
    if (!this.headings.length) {
      this.clearActiveHeading();
      return;
    }

    const rootRect = this.host.scrollRoot.getBoundingClientRect();
    const activationLine = rootRect.top + 110;
    let active = null;

    for (const heading of this.headings) {
      const rect = heading.element.getBoundingClientRect();
      if (rect.top <= activationLine) {
        active = heading;
        continue;
      }
      break;
    }

    if (!active) {
      const first = this.headings[0];
      const firstRect = first.element.getBoundingClientRect();
      const firstIsVisible = firstRect.top < rootRect.bottom && firstRect.bottom > rootRect.top;
      if (firstIsVisible) active = first;
    }

    if (active) {
      this.setActiveHeading(active.id);
    } else {
      this.clearActiveHeading();
    }
  }

  clearActiveHeading() {
    if (!this.activeHeadingId) return;
    const currentItems = this.tocItems.get(this.activeHeadingId) || [];
    for (const current of currentItems) {
      current.classList.remove('is-active');
      current.removeAttribute('aria-current');
    }
    this.activeHeadingId = '';
  }

  setActiveHeading(id) {
    if (!id) return;
    const expanded = !this.tocFilterQuery && this.expandTocAncestors(id, { apply: false });
    if (expanded) this.applyTocFilter();

    if (this.activeHeadingId === id && !expanded) return;
    if (this.activeHeadingId && this.tocItems.has(this.activeHeadingId)) {
      for (const previous of this.tocItems.get(this.activeHeadingId)) {
        previous.classList.remove('is-active');
        previous.removeAttribute('aria-current');
      }
    }

    this.activeHeadingId = id;
    const currentItems = this.tocItems.get(id) || [];
    for (const current of currentItems) {
      current.classList.add('is-active');
      current.setAttribute('aria-current', 'location');
    }

    const shouldScrollToc = !this.tocFilterQuery;
    const panelItem = currentItems.find(item => item.dataset.tocContext === 'panel');
    if (
      shouldScrollToc &&
      panelItem &&
      this.host.sidebar.activeSidebarTab === 'outline' &&
      !this.elements.outlinePanel.hidden &&
      this.isTocItemVisible(panelItem)
    ) {
      panelItem.scrollIntoView({ block: 'nearest' });
    }

    const popoverItem = currentItems.find(item => item.dataset.tocContext === 'popover');
    if (
      shouldScrollToc &&
      popoverItem &&
      this.tocPopoverOpen &&
      this.isTocItemVisible(popoverItem)
    ) {
      popoverItem.scrollIntoView({ block: 'nearest' });
    }
  }

  isTocItemVisible(item) {
    const row = item.closest('.toc-row');
    return Boolean(row && !row.hidden);
  }
}
