import { MarkdownEngine } from '../core/markdown/MarkdownEngine.js';
import { getArrowRightIcon, getFolderClosedIcon, getFileIcon, getArrowUpIcon, getArrowDownIcon } from '../core/ui/icons.js';
import { SourceCodeRenderer } from '../core/source/SourceCodeRenderer.js';
import { buildSourceSymbolTree, extractSourceSymbols } from '../core/source/sourceSymbols.js';
import { DiffRenderer } from '../core/diff/DiffRenderer.js';
import { buildDiffOutlineTree } from '../core/diff/diffOutlineTree.js';
import { FORMAT_IDS, detectFormat, detectLineEnding, displayNameFromUrl, formatLabel, lineEndingLabel, sourceLanguageFromPath } from '../core/format/fileTypes.js';
import { UrlSourceProvider } from '../core/sources/UrlSourceProvider.js';
import { FilePickerSourceProvider } from '../core/sources/FilePickerSourceProvider.js';
import { DirectorySourceProvider } from '../core/sources/DirectorySourceProvider.js';
import { DirectoryTreeView } from '../features/sidebar/DirectoryTreeView.js';
import { PluginRegistry } from '../plugins/PluginRegistry.js';
import { mermaidPlugin } from '../plugins/mermaidPlugin.js';
import { copyExtensionSettingsUrl, isFileUrlAccessAllowed, openExtensionSettings } from '../core/browser/fileUrlAccess.js';
import { buildHeadingIndex, buildHeadingTree, ensureHeadingAnchors } from '../core/toc/headingIndex.js';
import { isLikelyBinaryFile } from '../core/format/binarySniff.js';
import { localizeDocument, t } from '../core/i18n/i18n.js';
import {
  contentWidthLabel,
  extractHash,
  immediateParentId,
  isSupportedDroppedName,
  normalizeThemePreference,
  normalizeDroppedEntryPath,
  normalizeLinkData,
  resolveThemePreference,
  safeDecodeURIComponent,
  symbolKindLabel,
  themeLabel
} from './viewerHelpers.js';

const SCROLL_ENABLED_KEY = 'devFileViewer:rememberScrollEnabled';
const SCROLL_POSITIONS_KEY = 'devFileViewer:scrollPositions';
const SIDEBAR_COLLAPSED_KEY = 'devFileViewer:sidebarCollapsed';
const SIDEBAR_WIDTH_KEY = 'devFileViewer:sidebarWidth';
const CONTENT_WIDTH_KEY = 'devFileViewer:contentWidth';
const THEME_KEY = 'devFileViewer:theme';
const VIEWER_FONT_SIZE_KEY = 'devFileViewer:viewerFontSize';
const TOC_POPOVER_PINNED_KEY = 'devFileViewer:tocPopoverPinned';
const DEFAULT_SIDEBAR_WIDTH = 322;
const MIN_SIDEBAR_WIDTH = 240;
const MAX_SIDEBAR_WIDTH = 560;
const DEFAULT_CONTENT_WIDTH = 'comfortable';
const DEFAULT_THEME = 'system';
const DEFAULT_VIEWER_FONT_SIZE = 15;
const MIN_VIEWER_FONT_SIZE = 12;
const MAX_VIEWER_FONT_SIZE = 24;
const CONTENT_WIDTHS = {
  narrow: '760px',
  comfortable: '920px',
  wide: '1180px',
  full: '100%'
};
const TOC_FILTER_THRESHOLD = 12;
const DEFAULT_TOC_MAX_LEVEL = 3;
const TOC_DEPTH_LEVELS = new Set([2, 3, 4, 5, 6]);

class DevFileViewerApp {
  constructor() {
    this.elements = {
      app: document.querySelector('#app'),
      sidebar: document.querySelector('#sidebar'),
      title: document.querySelector('#doc-title'),
      source: document.querySelector('#doc-source'),
      reloadDocument: document.querySelector('#btn-reload-document'),
      format: document.querySelector('#doc-format'),
      status: document.querySelector('#status'),
      preview: document.querySelector('#preview'),
      viewerMain: document.querySelector('#viewer-main'),
      viewerScroll: document.querySelector('#viewer-scroll'),
      sidebarTools: document.querySelector('#sidebar-tools'),
      sidebarToggle: document.querySelector('#btn-sidebar-toggle'),
      sidebarRestore: document.querySelector('#btn-sidebar-restore'),
      floatingOutline: document.querySelector('#btn-floating-outline'),
      popoutOutline: document.querySelector('#btn-popout-outline'),
      tocPopover: document.querySelector('#toc-popover'),
      closeTocPopover: document.querySelector('#btn-close-toc-popover'),
      pinTocPopover: document.querySelector('#btn-pin-toc-popover'),
      scrollNav: document.querySelector('#scroll-nav'),
      btnScrollTop: document.querySelector('#btn-scroll-top'),
      btnScrollBottom: document.querySelector('#btn-scroll-bottom'),
      sidebarResizer: document.querySelector('#sidebar-resizer'),
      scrollMemoryCard: document.querySelector('#scroll-memory-card'),
      rememberScroll: document.querySelector('#remember-scroll'),
      openFile: document.querySelector('#btn-open-file'),
      openFolder: document.querySelector('#btn-open-folder'),
      reloadFolder: document.querySelector('#btn-reload-folder'),
      openUrl: document.querySelector('#btn-open-url'),
      urlBox: document.querySelector('#url-box'),
      urlInput: document.querySelector('#url-input'),
      loadUrl: document.querySelector('#btn-load-url'),
      tree: document.querySelector('#directory-tree'),
      fileUrlCard: document.querySelector('#file-url-card'),
      fileUrlStatus: document.querySelector('#file-url-status'),
      openExtensionSettings: document.querySelector('#btn-open-extension-settings'),
      copySettingsLink: document.querySelector('#btn-copy-settings-link'),
      useOpenFile: document.querySelector('#btn-use-open-file'),
      contentWidth: document.querySelector('#content-width-select'),
      theme: document.querySelector('#theme-select'),
      viewerFontSizeRange: document.querySelector('#viewer-font-size-range'),
      viewerFontSizeInput: document.querySelector('#viewer-font-size-input'),
      activityRailButtons: document.querySelectorAll('[data-rail-target]'),
      fileTabs: document.querySelector('#file-tabs'),
      fileTabName: document.querySelector('#file-tabs .file-tab-name'),
      closeFileTab: document.querySelector('#btn-close-file-tab'),
      sidebarTabs: document.querySelectorAll('[data-sidebar-tab]'),
      filesTab: document.querySelector('#tab-files'),
      outlineTab: document.querySelector('#tab-outline'),
      filesPanel: document.querySelector('#files-panel'),
      outlinePanel: document.querySelector('#outline-panel'),
      tocTree: document.querySelector('#toc-tree'),
      tocTitleLabel: document.querySelector('#toc-title-label'),
      tocFileName: document.querySelector('#toc-file-name'),
      tocDepthRow: document.querySelector('#toc-depth-row'),
      tocDepth: document.querySelector('#toc-depth-select'),
      tocFilterRow: document.querySelector('#toc-filter-row'),
      tocFilter: document.querySelector('#toc-filter'),
      tocPopoverTree: document.querySelector('#toc-popover-tree'),
      tocPopoverTitleLabel: document.querySelector('#toc-popover-title-label'),
      tocPopoverFileName: document.querySelector('#toc-popover-file-name'),
      tocPopoverDepthRow: document.querySelector('#toc-popover-depth-row'),
      tocPopoverDepth: document.querySelector('#toc-popover-depth-select'),
      tocPopoverFilterRow: document.querySelector('#toc-popover-filter-row'),
      tocPopoverFilter: document.querySelector('#toc-popover-filter'),
      dropOverlay: document.querySelector('#drop-overlay')
    };

    this.plugins = new PluginRegistry([mermaidPlugin]);
    this.markdown = new MarkdownEngine(this.plugins);
    this.sourceRenderer = new SourceCodeRenderer();
    this.diffRenderer = new DiffRenderer();
    this.urlSource = new UrlSourceProvider();
    this.fileSource = new FilePickerSourceProvider();
    this.directorySource = new DirectorySourceProvider();
    this.directoryTree = new DirectoryTreeView(this.elements.tree);

    this.currentDoc = null;
    this.currentDocKey = '';
    this.currentFolderLoaded = false;
    this.rememberScrollEnabled = false;
    this.scrollPositions = {};
    this.scrollSaveTimer = 0;
    this.sidebarCollapsed = false;
    this.sidebarWidth = DEFAULT_SIDEBAR_WIDTH;
    this.resizeDrag = null;
    this.contentWidth = DEFAULT_CONTENT_WIDTH;
    this.themePreference = DEFAULT_THEME;
    this.viewerFontSize = DEFAULT_VIEWER_FONT_SIZE;
    this.themeMediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)') || null;
    this.activeSidebarTab = 'files';
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
    this.dragDepth = 0;
  }

  get scrollRoot() {
    return this.elements.viewerScroll || this.elements.viewerMain;
  }

  async start() {
    localizeDocument();
    await this.plugins.init();
    await this.restoreTheme();
    await this.restoreContentWidth();
    await this.restoreViewerFontSize();
    await this.restoreSidebarWidth();
    await this.restoreSidebarState();
    await this.restoreTocPopoverPinState();
    this.applySidebarTab('files');
    await this.restoreScrollSettings();
    this.bindEvents();
    await this.refreshFileUrlAccessStatus();
    await this.loadFromLaunchParams();
  }

  bindEvents() {
    this.elements.sidebarToggle.addEventListener('click', () => this.setSidebarCollapsed(true));
    this.elements.sidebarRestore.addEventListener('click', () => this.setSidebarCollapsed(false));
    this.elements.floatingOutline.addEventListener('pointerdown', event => this.startFloatingOutlineDrag(event));
    this.elements.floatingOutline.addEventListener('click', event => {
      if (this.ignoreNextFloatingOutlineClick) {
        event.preventDefault();
        event.stopPropagation();
        this.ignoreNextFloatingOutlineClick = false;
        this.dragDepth = 0;
        return;
      }
      this.toggleTocPopover();
    });
    this.elements.closeTocPopover.addEventListener('click', () => this.closeTocPopover({ force: true }));
    this.elements.pinTocPopover.addEventListener('click', () => this.setTocPopoverPinned(!this.tocPopoverPinned));
    this.elements.popoutOutline.addEventListener('click', () => this.toggleOutlinePopout());
    this.elements.sidebarResizer.addEventListener('pointerdown', event => this.startSidebarResize(event));
    this.elements.sidebarResizer.addEventListener('keydown', event => this.handleSidebarResizeKey(event));
    this.elements.sidebarResizer.addEventListener('dblclick', () => this.resetSidebarWidth());
    this.elements.openFile.addEventListener('click', () => this.openLocalFile());
    this.elements.reloadDocument.addEventListener('click', () => this.reloadCurrentDocument());
    this.elements.openFolder.addEventListener('click', () => this.openLocalFolder());
    this.elements.reloadFolder.addEventListener('click', () => this.reloadCurrentFolder());
    this.elements.openUrl.addEventListener('click', () => {
      this.elements.urlBox.hidden = !this.elements.urlBox.hidden;
      if (!this.elements.urlBox.hidden) this.elements.urlInput.focus();
    });
    this.elements.loadUrl.addEventListener('click', () => this.openUrl(this.elements.urlInput.value.trim()));
    this.elements.urlInput.addEventListener('keydown', event => {
      if (event.key === 'Enter') this.openUrl(this.elements.urlInput.value.trim());
    });
    this.elements.openExtensionSettings.addEventListener('click', () => this.openExtensionSettingsPage());
    this.elements.copySettingsLink.addEventListener('click', () => this.copySettingsUrl());
    this.elements.useOpenFile.addEventListener('click', () => this.openLocalFile());
    this.elements.rememberScroll.addEventListener('change', () => this.setRememberScroll(this.elements.rememberScroll.checked));
    this.elements.contentWidth.addEventListener('change', () => this.setContentWidth(this.elements.contentWidth.value));
    this.elements.theme?.addEventListener('change', () => this.setThemePreference(this.elements.theme.value));
    this.elements.viewerFontSizeRange?.addEventListener('input', () => this.applyViewerFontSize(this.elements.viewerFontSizeRange.value));
    this.elements.viewerFontSizeRange?.addEventListener('change', () => this.setViewerFontSize(this.elements.viewerFontSizeRange.value));
    this.elements.viewerFontSizeInput?.addEventListener('change', () => this.setViewerFontSize(this.elements.viewerFontSizeInput.value));
    this.themeMediaQuery?.addEventListener?.('change', () => {
      if (this.themePreference === 'system') this.applyTheme();
    });
    window.addEventListener('dragenter', event => this.handleWindowDragEnter(event));
    window.addEventListener('dragover', event => this.handleWindowDragOver(event));
    window.addEventListener('dragleave', event => this.handleWindowDragLeave(event));
    window.addEventListener('drop', event => this.handleWindowDrop(event));
    this.elements.tocDepth.addEventListener('change', () => this.setTocDepth(this.elements.tocDepth.value));
    this.elements.tocPopoverDepth.addEventListener('change', () => this.setTocDepth(this.elements.tocPopoverDepth.value));
    this.elements.tocFilter.addEventListener('input', () => this.setTocFilter(this.elements.tocFilter.value));
    this.elements.tocPopoverFilter.addEventListener('input', () => this.setTocFilter(this.elements.tocPopoverFilter.value));
    document.addEventListener('keydown', event => this.handleGlobalKeydown(event));
    document.addEventListener('pointerdown', event => this.handleDocumentPointerDown(event));
    window.addEventListener('resize', () => this.reflowFloatingTocPosition());
    for (const tab of this.elements.sidebarTabs) {
      tab.addEventListener('click', () => this.setSidebarTab(tab.dataset.sidebarTab));
    }
    for (const button of this.elements.activityRailButtons) {
      button.addEventListener('click', () => this.handleActivityRailClick(button.dataset.railTarget));
    }
    this.elements.closeFileTab?.addEventListener('click', () => this.closeFileTab());
    this.elements.preview.addEventListener('click', event => this.handlePreviewAnchorClick(event));
    this.scrollRoot.addEventListener('scroll', () => {
      this.scheduleSaveScrollPosition();
      this.scheduleActiveHeadingUpdate();
    }, { passive: true });

    // Set SVG content for scroll buttons
    this.elements.btnScrollTop.innerHTML = getArrowUpIcon('scroll-nav-icon');
    this.elements.btnScrollBottom.innerHTML = getArrowDownIcon('scroll-nav-icon');

    // Scroll buttons event listeners
    this.elements.btnScrollTop.addEventListener('click', () => {
      this.scrollRoot.scrollTo({ top: 0, behavior: 'smooth' });
    });
    this.elements.btnScrollBottom.addEventListener('click', () => {
      this.scrollRoot.scrollTo({
        top: this.scrollRoot.scrollHeight,
        behavior: 'smooth'
      });
    });
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
    if (this.elements.tocPopover.contains(target) || this.elements.floatingOutline.contains(target)) return;
    this.closeTocPopover();
  }

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

    const shouldShow = hasHeadings && (this.sidebarCollapsed || this.tocPopoverPinned || this.outlinePopoutEnabled);
    const wasFloatingHidden = this.elements.floatingOutline.hidden;
    this.elements.floatingOutline.hidden = !shouldShow;
    this.updateOutlinePopoutControl();

    if (!shouldShow) {
      this.closeTocPopover();
      return;
    }

    this.reflowFloatingTocPosition();
    const shouldAutoOpen = options.openPopover || (this.sidebarCollapsed && wasFloatingHidden);
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
        this.dragDepth = 0;
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
    const padding = 16;
    const buttonRect = this.elements.floatingOutline.getBoundingClientRect();
    const buttonWidth = buttonRect.width || 92;

    let left;
    let top;

    if (previewRect.width > 0) {
      // Place it at the top-right of the preview container
      left = previewRect.right - padding - buttonWidth;
      // Shift it down to align with the preview top, keeping at least 80px from viewport top to avoid header
      top = Math.max(viewerRect.top + 80, previewRect.top + 12);
    } else {
      // Fallback if preview is not yet sized/rendered
      left = viewerRect.right - padding - buttonWidth;
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
    const width = rect.width || 92;
    const height = rect.height || 38;
    const maxLeft = Math.max(bounds.minLeft, bounds.maxRight - width);
    const maxTop = Math.max(bounds.minTop, bounds.maxBottom - height);

    return {
      left: Math.min(Math.max(Number(position.left) || bounds.minLeft, bounds.minLeft), maxLeft),
      top: Math.min(Math.max(Number(position.top) || bounds.minTop, bounds.minTop), maxTop)
    };
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
    const measuredHeight = Math.min(popover.hidden ? 480 : (popover.offsetHeight || 480), viewportHeight || 480);
    const belowTop = buttonRect.bottom + gap;
    const belowSpace = Math.max(0, bounds.maxBottom - belowTop);
    const aboveSpace = Math.max(0, buttonRect.top - gap - bounds.minTop);
    const targetSpace = belowSpace >= Math.min(measuredHeight, 220) || belowSpace >= aboveSpace
      ? belowSpace
      : aboveSpace;
    const minHeight = Math.min(80, viewportHeight || 80);
    const popoverHeight = Math.min(measuredHeight, Math.max(minHeight, targetSpace));
    let left = buttonRect.left;
    let top = targetSpace === belowSpace
      ? belowTop
      : buttonRect.top - popoverHeight - gap;

    if (left + popoverWidth > bounds.maxRight) {
      left = Math.min(buttonRect.right - popoverWidth, bounds.maxRight - popoverWidth);
    }
    if (top < bounds.minTop) top = bounds.minTop;
    if (top + popoverHeight > bounds.maxBottom) top = Math.max(bounds.minTop, bounds.maxBottom - popoverHeight);
    if (left < bounds.minLeft) left = bounds.minLeft;

    popover.style.left = `${Math.round(left)}px`;
    popover.style.top = `${Math.round(top)}px`;
    popover.style.width = `${Math.round(popoverWidth)}px`;
    popover.style.maxHeight = `${Math.round(popoverHeight)}px`;
  }

  setSidebarTab(tab) {
    this.applySidebarTab(tab);
  }

  applySidebarTab(tab) {
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
    this.syncActivityRail();
  }

  handleActivityRailClick(target) {
    if (target === 'sidebar-tools') {
      if (this.elements.sidebarTools) this.elements.sidebarTools.open = !this.elements.sidebarTools.open;
      return;
    }

    if (target === 'btn-open-url') {
      if (this.elements.sidebarTools) this.elements.sidebarTools.open = true;
      this.elements.openUrl?.click();
      return;
    }

    if (target === 'tab-files') {
      this.setSidebarTab('files');
      this.elements.filesTab?.focus();
      return;
    }

    if (target === 'tab-outline') {
      this.setSidebarTab('outline');
      this.elements.outlineTab?.focus();
    }
  }

  syncActivityRail() {
    const activeTarget = this.activeSidebarTab === 'outline' ? 'tab-outline' : 'tab-files';
    for (const button of this.elements.activityRailButtons) {
      button.classList.toggle('is-active', button.dataset.railTarget === activeTarget);
    }
  }

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
    this.setStatus(t('statusThemeSet', [themeLabel(this.themePreference)]), 'success');
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

  async restoreContentWidth() {
    const stored = await chrome.storage.local.get(CONTENT_WIDTH_KEY);
    this.applyContentWidth(stored[CONTENT_WIDTH_KEY] || DEFAULT_CONTENT_WIDTH);
  }

  applyContentWidth(value) {
    const widthKey = Object.prototype.hasOwnProperty.call(CONTENT_WIDTHS, value) ? value : DEFAULT_CONTENT_WIDTH;
    this.contentWidth = widthKey;
    this.elements.contentWidth.value = widthKey;
    this.elements.app.classList.toggle('content-width-full', widthKey === 'full');
    this.elements.app.style.setProperty('--markdown-body-width', CONTENT_WIDTHS[widthKey]);
  }

  async setContentWidth(value) {
    this.applyContentWidth(value);
    await chrome.storage.local.set({ [CONTENT_WIDTH_KEY]: this.contentWidth });
    this.setStatus(t('statusContentWidthSet', [contentWidthLabel(this.contentWidth)]), 'info');
    await nextFrame();
  }

  async restoreViewerFontSize() {
    const stored = await chrome.storage.local.get(VIEWER_FONT_SIZE_KEY);
    this.applyViewerFontSize(stored[VIEWER_FONT_SIZE_KEY] || DEFAULT_VIEWER_FONT_SIZE);
  }

  clampViewerFontSize(value) {
    const numericSize = Number(value);
    if (!Number.isFinite(numericSize)) return DEFAULT_VIEWER_FONT_SIZE;
    return Math.min(Math.max(Math.round(numericSize), MIN_VIEWER_FONT_SIZE), MAX_VIEWER_FONT_SIZE);
  }

  applyViewerFontSize(value) {
    this.viewerFontSize = this.clampViewerFontSize(value);
    this.elements.preview.style.setProperty('--viewer-font-size', `${this.viewerFontSize}px`);
    if (this.elements.viewerFontSizeRange) {
      const progress = ((this.viewerFontSize - MIN_VIEWER_FONT_SIZE) / (MAX_VIEWER_FONT_SIZE - MIN_VIEWER_FONT_SIZE)) * 100;
      this.elements.viewerFontSizeRange.value = String(this.viewerFontSize);
      this.elements.viewerFontSizeRange.style.setProperty('--viewer-font-size-progress', `${progress}%`);
    }
    if (this.elements.viewerFontSizeInput) this.elements.viewerFontSizeInput.value = String(this.viewerFontSize);
  }

  async setViewerFontSize(value) {
    this.applyViewerFontSize(value);
    await chrome.storage.local.set({ [VIEWER_FONT_SIZE_KEY]: this.viewerFontSize });
    this.setStatus(t('statusViewerTextSizeSet', [String(this.viewerFontSize)]), 'info');
  }

  async restoreSidebarWidth() {
    const stored = await chrome.storage.local.get(SIDEBAR_WIDTH_KEY);
    const width = this.clampSidebarWidth(Number(stored[SIDEBAR_WIDTH_KEY]));
    this.applySidebarWidth(width, { updateAria: true });
  }

  clampSidebarWidth(width) {
    const viewportLimit = Math.max(MIN_SIDEBAR_WIDTH, Math.min(MAX_SIDEBAR_WIDTH, Math.floor(window.innerWidth * 0.6)));
    const numericWidth = Number.isFinite(width) && width > 0 ? width : DEFAULT_SIDEBAR_WIDTH;
    return Math.min(Math.max(Math.round(numericWidth), MIN_SIDEBAR_WIDTH), viewportLimit);
  }

  applySidebarWidth(width, options = {}) {
    this.sidebarWidth = this.clampSidebarWidth(width);
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
    this.reflowFloatingTocPosition();
  }

  async finishSidebarResize(event) {
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
    this.reflowFloatingTocPosition();
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
    this.reflowFloatingTocPosition();
  }

  async resetSidebarWidth() {
    this.applySidebarWidth(DEFAULT_SIDEBAR_WIDTH);
    await this.persistSidebarWidth();
    this.reflowFloatingTocPosition();
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
    this.elements.sidebarRestore.hidden = !this.sidebarCollapsed;
    this.elements.sidebarResizer.setAttribute('aria-hidden', String(this.sidebarCollapsed));
    this.elements.sidebarResizer.tabIndex = this.sidebarCollapsed ? -1 : 0;
    this.elements.sidebarToggle.setAttribute('aria-expanded', String(!this.sidebarCollapsed));
    this.elements.sidebarToggle.setAttribute('aria-label', this.sidebarCollapsed ? t('a11yShowSidebar') : t('a11yHideSidebar'));
    this.elements.sidebarToggle.title = this.sidebarCollapsed ? t('a11yShowSidebar') : t('a11yHideSidebar');
    this.elements.sidebar.setAttribute('aria-hidden', String(this.sidebarCollapsed));

    if (shouldPersist) {
      await chrome.storage.local.set({ [SIDEBAR_COLLAPSED_KEY]: this.sidebarCollapsed });
    }

    await nextFrame();
    this.updateFloatingOutlineState({ openPopover: !wasCollapsed && this.sidebarCollapsed });
  }

  async restoreScrollSettings() {
    const stored = await chrome.storage.session.get([SCROLL_ENABLED_KEY, SCROLL_POSITIONS_KEY]);
    this.rememberScrollEnabled = Boolean(stored[SCROLL_ENABLED_KEY]);
    this.scrollPositions = stored[SCROLL_POSITIONS_KEY] || {};
    this.elements.rememberScroll.checked = this.rememberScrollEnabled;
  }

  async setRememberScroll(enabled) {
    this.rememberScrollEnabled = Boolean(enabled);
    this.elements.rememberScroll.checked = this.rememberScrollEnabled;
    await chrome.storage.session.set({ [SCROLL_ENABLED_KEY]: this.rememberScrollEnabled });

    if (this.rememberScrollEnabled) {
      await this.saveCurrentScrollPosition();
      this.setStatus(t('statusScrollEnabled'), 'info');
    } else {
      this.setStatus(t('statusScrollDisabled'), 'info');
    }
  }

handleWindowDragEnter(event) {
  if (!this.dragEventHasFiles(event)) return;
  event.preventDefault();
  event.stopPropagation();
  this.dragDepth += 1;
  this.setDropOverlayVisible(true);
}

handleWindowDragOver(event) {
  if (!this.dragEventHasFiles(event)) return;
  event.preventDefault();
  event.stopPropagation();
  event.dataTransfer.dropEffect = 'copy';
  this.setDropOverlayVisible(true);
}

handleWindowDragLeave(event) {
  if (!this.dragEventHasFiles(event)) return;
  event.preventDefault();
  event.stopPropagation();
  this.dragDepth = Math.max(0, this.dragDepth - 1);
  if (this.dragDepth === 0) this.setDropOverlayVisible(false);
}

async handleWindowDrop(event) {
  if (!this.dragEventHasFiles(event)) return;
  event.preventDefault();
  event.stopPropagation();
  this.dragDepth = 0;
  this.setDropOverlayVisible(false);

  try {
    this.setStatus(t('statusOpeningDropped'), 'info');
    const item = await this.resolveDroppedItem(event.dataTransfer);
    if (!item) {
      this.setStatus(t('statusNoSupportedDropped'), 'warning');
      return;
    }

    if (item.kind === 'directory-handle') {
      await this.openDroppedDirectoryHandle(item.handle);
      return;
    }

    if (item.kind === 'directory-entry') {
      await this.openDroppedDirectoryEntry(item.entry);
      return;
    }

    if (item.kind === 'file-handle') {
      this.setViewerLoading(t('statusLoadingDocument', [item.handle.name || t('commonDocument')]));
      const file = await item.handle.getFile();
      const doc = await this.loadDroppedFileDocument(file, {
        handle: item.handle,
        forcePlainText: item.forcePlainText,
        displayPath: item.handle.name
      });
      await this.renderDocument(doc);
      return;
    }

    if (item.kind === 'file-entry') {
      this.setViewerLoading(t('statusLoadingDocument', [item.entry.name || t('commonDocument')]));
      const file = await fileFromDroppedEntry(item.entry);
      const doc = await this.loadDroppedFileDocument(file, {
        forcePlainText: item.forcePlainText,
        path: normalizeDroppedEntryPath(item.entry.fullPath || item.entry.name || file.name)
      });
      await this.renderDocument(doc);
      return;
    }

    if (item.kind === 'file') {
      const relativePath = item.file.webkitRelativePath || '';
      this.setViewerLoading(t('statusLoadingDocument', [relativePath || item.file.name || t('commonDocument')]));
      const doc = await this.loadDroppedFileDocument(item.file, {
        forcePlainText: item.forcePlainText,
        relativePath,
        displayPath: relativePath || item.file.name
      });
      await this.renderDocument(doc);
      return;
    }

    this.setStatus(t('statusNoSupportedDropped'), 'warning');
  } catch (error) {
    this.clearViewerLoading();
    this.clearDirectoryTreeLoading();
    this.setStatus(error?.message || String(error), 'error');
  }
}

dragEventHasFiles(event) {
  return Array.from(event.dataTransfer?.types || []).includes('Files');
}

setDropOverlayVisible(visible) {
  if (!this.elements.dropOverlay) return;
  this.elements.dropOverlay.hidden = !visible;
  this.elements.dropOverlay.setAttribute('aria-hidden', String(!visible));
  this.elements.app.classList.toggle('is-dragging-file', Boolean(visible));
}

async resolveDroppedItem(dataTransfer) {
  const items = Array.from(dataTransfer?.items || []).filter(item => item.kind === 'file');

  for (const item of items) {
    if (typeof item.getAsFileSystemHandle === 'function') {
      try {
        const handle = await item.getAsFileSystemHandle();
        if (handle?.kind === 'directory') return { kind: 'directory-handle', handle };
        if (handle?.kind === 'file') {
          return {
            kind: 'file-handle',
            handle,
            forcePlainText: !isSupportedDroppedName(handle.name)
          };
        }
      } catch {
        // Fall through to older APIs.
      }
    }

    if (typeof item.webkitGetAsEntry === 'function') {
      const entry = item.webkitGetAsEntry();
      if (entry?.isDirectory) return { kind: 'directory-entry', entry };
      if (entry?.isFile) {
        return {
          kind: 'file-entry',
          entry,
          forcePlainText: !isSupportedDroppedName(entry.name)
        };
      }
    }

    const file = item.getAsFile?.();
    if (file) {
      return {
        kind: 'file',
        file,
        forcePlainText: !isSupportedDroppedName(file.name)
      };
    }
  }

  const files = Array.from(dataTransfer?.files || []);
  const supportedFile = files.find(candidate => isSupportedDroppedName(candidate.name));
  if (supportedFile) return { kind: 'file', file: supportedFile, forcePlainText: false };
  const firstFile = files[0];
  return firstFile ? { kind: 'file', file: firstFile, forcePlainText: true } : null;
}

async loadDroppedFileDocument(file, options = {}) {
  if (options.forcePlainText && await isLikelyBinaryFile(file)) {
    throw new Error(t('errorDroppedBinary', [file.name]));
  }

  const doc = await this.fileSource.loadFromFile(file, options.handle ? { handle: options.handle } : {});
  doc.sourceType = 'dropped-file';
  doc.relativePath = options.relativePath || '';
  doc.displayPath = options.displayPath || doc.relativePath || file.name || doc.name;

  if (options.path) doc.path = options.path;

  if (options.forcePlainText) {
    doc.format = FORMAT_IDS.SOURCE_CODE;
    doc.language = 'plaintext';
    doc.mimeType = file.type || 'text/plain';
  }

  return doc;
}

async openDroppedDirectoryHandle(handle) {
  this.elements.sidebarTools.open = false;
  this.setDirectoryTreeLoading(t('statusOpeningFolder'));
  const { tree } = await this.directorySource.loadDirectoryHandle(handle);
  this.renderDirectoryTree(tree);
  this.currentFolderLoaded = true;
  this.setFolderReloadEnabled(true);
  this.elements.scrollMemoryCard.hidden = false;
  this.applySidebarTab('files');
  this.setStatus(t('statusDroppedFolderLoaded'), 'success');
}

async openDroppedDirectoryEntry(entry) {
  this.elements.sidebarTools.open = false;
  this.setDirectoryTreeLoading(t('statusOpeningFolder'));
  const { tree } = await this.directorySource.loadDirectoryEntry(entry);
  this.renderDirectoryTree(tree);
  this.currentFolderLoaded = true;
  this.setFolderReloadEnabled(true);
  this.elements.scrollMemoryCard.hidden = false;
  this.applySidebarTab('files');
  this.setStatus(t('statusDroppedFolderLoaded'), 'success');
}

  async loadFromLaunchParams() {
    const params = new URLSearchParams(window.location.search);
    const snapshotId = params.get('snapshot');
    const url = params.get('url');

    if (snapshotId) {
      await this.openSnapshot(snapshotId, { anchor: extractHash(window.location.hash) });
      return;
    }

    if (url) await this.openUrl(url, { anchor: extractHash(window.location.hash) || extractHash(url) });
  }

  async openSnapshot(snapshotId, options = {}) {
    const key = `sourceSnapshot:${snapshotId}`;
    const stored = await chrome.storage.session.get(key);
    const snapshot = stored[key];

    if (!snapshot) {
      throw new Error(t('errorSnapshotUnavailable'));
    }

    const doc = {
      id: snapshot.url || snapshotId,
      name: displayNameFromUrl(snapshot.url || snapshot.title || 'Untitled'),
      sourceType: 'captured-url',
      baseUrl: snapshot.url || '',
      url: snapshot.url || '',
      mimeType: snapshot.mimeType || '',
      format: snapshot.format || detectFormat({ url: snapshot.url || '', mimeType: snapshot.mimeType || '' }),
      language: snapshot.language || '',
      text: snapshot.text || ''
    };

    await this.renderDocument(doc, options);
  }

  async openUrl(url, options = {}) {
    if (!url) return;
    try {
      this.setViewerLoading();
      this.setStatus(t('statusLoadingUrl', [url]), 'info');
      const doc = await this.urlSource.load(url);
      await this.renderDocument(doc, { anchor: options.anchor || extractHash(url) });
    } catch (error) {
      this.clearViewerLoading();
      await this.showLoadError(error, url);
    }
  }

  async openLocalFile() {
    try {
      const doc = await this.fileSource.pickFile({
        onLoadStart: name => this.setViewerLoading(t('statusLoadingDocument', [name || t('commonDocument')]))
      });
      await this.renderDocument(doc);
    } catch (error) {
      this.clearViewerLoading();
      if (error?.name === 'AbortError') return;
      this.setStatus(error?.message || String(error), 'error');
    }
  }

  async openLocalFolder() {
    try {
      this.setStatus(t('statusOpeningFolder'), 'info');
      const { tree } = await this.directorySource.pickDirectory({
        onLoadStart: () => {
          this.elements.sidebarTools.open = false;
          this.setDirectoryTreeLoading(t('statusOpeningFolder'));
        }
      });
      this.renderDirectoryTree(tree);
      this.currentFolderLoaded = true;
      this.setFolderReloadEnabled(true);
      this.clearViewerForFolder(t('statusFolderLoaded'));
      this.elements.scrollMemoryCard.hidden = false;
      this.applySidebarTab('files');
      this.setStatus(t('statusFolderLoaded'), 'success');
    } catch (error) {
      this.clearDirectoryTreeLoading();
      if (error?.name === 'AbortError') return;
      this.currentFolderLoaded = false;
      this.setFolderReloadEnabled(false);
      this.directoryTree.showEmpty(t('statusFolderCouldNotOpen'));
      this.setStatus(error?.message || String(error), 'error');
    }
  }

  clearViewerForFolder(message = t('statusSelectFromSidebar')) {
    this.currentDoc = null;
    this.currentDocKey = '';
    this.hideFileTab();
    this.clearViewerLoading();
    this.clearSourceLineHighlight();
    this.clearToc();
    this.setDocumentReloadEnabled(false);
    this.elements.title.textContent = t('titleNoFileSelected');
    document.title = t('appName');
    this.elements.scrollNav.hidden = true;
    this.elements.source.textContent = message;
    this.elements.format.textContent = t('formatFolder');
    this.elements.preview.classList.remove('source-code-body', 'diff-body');
    this.elements.preview.textContent = '';
    this.scrollRoot.scrollTop = 0;
  }

  async clearViewerForFailedDocument(fileNode = {}) {
    await this.saveCurrentScrollPosition();
    const path = fileNode.path || fileNode.displayPath || fileNode.name || '';
    const name = fileNode.name || (path ? displayNameFromUrl(path) : t('titleNoFileSelected'));

    this.currentDoc = null;
    this.currentDocKey = '';
    this.hideFileTab();
    this.clearViewerLoading();
    this.clearSourceLineHighlight();
    this.clearToc();
    this.setDocumentReloadEnabled(false);
    this.elements.title.textContent = name;
    document.title = `${name} - ${t('appName')}`;
    this.elements.scrollNav.hidden = true;
    this.elements.source.textContent = path || t('statusSelectFromSidebar');
    this.elements.format.textContent = formatLabel(FORMAT_IDS.UNKNOWN);
    this.elements.preview.classList.remove('source-code-body', 'diff-body');
    this.elements.preview.textContent = '';
    this.scrollRoot.scrollTop = 0;
  }

  async closeFileTab() {
    if (this.currentDoc) await this.saveCurrentScrollPosition();
    this.clearViewerForNoDocument();
    this.setStatus(t('statusNoDocumentLoaded'), 'info');
  }

  clearViewerForNoDocument(message = t('docSourceEmpty')) {
    this.currentDoc = null;
    this.currentDocKey = '';
    this.hideFileTab();
    this.clearViewerLoading();
    this.clearSourceLineHighlight();
    this.clearToc();
    this.setDocumentReloadEnabled(false);
    this.elements.title.textContent = t('appName');
    document.title = t('appName');
    this.elements.scrollNav.hidden = true;
    this.elements.source.textContent = message;
    this.elements.format.textContent = t('formatMarkdown');
    this.elements.preview.classList.remove('source-code-body', 'diff-body');
    this.elements.preview.textContent = '';
    this.scrollRoot.scrollTop = 0;
  }

  showFileTab(doc) {
    if (!this.elements.fileTabs) return;
    const label = doc?.name || t('docTitleUntitled');
    if (this.elements.fileTabName) {
      this.elements.fileTabName.textContent = label;
      this.elements.fileTabName.title = this.getDocumentSourceLabel(doc) || label;
    }
    this.elements.fileTabs.hidden = false;
  }

  hideFileTab() {
    if (this.elements.fileTabs) this.elements.fileTabs.hidden = true;
  }

  renderDirectoryTree(tree) {
    this.directoryTree.render(tree, async fileNode => {
      try {
        this.setViewerLoading(t('statusLoadingDocument', [fileNode.name || t('commonDocument')]));
        const doc = await this.createDirectoryDocument(fileNode);
        await this.renderDocument(doc);
      } catch (error) {
        await this.clearViewerForFailedDocument(fileNode);
        this.setStatus(this.getLoadErrorMessage(error), 'error');
      }
    });
    this.clearDirectoryTreeLoading();
  }

  async reloadCurrentFolder() {
    if (!this.currentFolderLoaded || !this.directorySource.rootHandle) {
      this.setStatus(t('statusNoFolderOpen'), 'info');
      return;
    }

    const activePath = this.directoryTree.activePath;

    try {
      this.setFolderReloadEnabled(false);
      this.setDirectoryTreeLoading(t('statusReloadingFolder'));
      this.setStatus(t('statusReloadingFolder'), 'info');
      const { tree } = await this.directorySource.reloadDirectory();
      this.renderDirectoryTree(tree);
      this.currentFolderLoaded = true;
      this.setFolderReloadEnabled(true);

      if (activePath) {
        this.directoryTree.markActivePath(activePath);
      }

      this.setStatus(t('statusFolderReloaded'), 'success');
    } catch (error) {
      this.clearDirectoryTreeLoading();
      this.currentFolderLoaded = Boolean(this.directorySource.rootHandle);
      this.setFolderReloadEnabled(this.currentFolderLoaded);
      this.setStatus(error?.message || String(error), 'error');
    }
  }

  setFolderReloadEnabled(enabled) {
    if (!this.elements.reloadFolder) return;
    this.elements.reloadFolder.hidden = !enabled;
    this.elements.reloadFolder.disabled = !enabled;
  }

async reloadCurrentDocument() {
  if (!this.currentDoc) {
    this.setStatus(t('statusNoDocumentLoaded'), 'info');
    return;
  }

  const previousDoc = this.currentDoc;
  const previousScrollTop = this.scrollRoot.scrollTop;
  const hashAnchor = extractHash(window.location.hash);

  try {
    this.setDocumentReloadEnabled(false);
    this.setViewerLoading(t('statusLoadingDocument', [previousDoc.name || t('commonDocument')]));
    this.setStatus(t('statusReloadingDocument', [previousDoc.name || t('commonDocument')]), 'info');

    const doc = await this.reloadDocumentSource(previousDoc);
    await this.renderDocument(doc, hashAnchor ? { anchor: hashAnchor } : {});

    if (!hashAnchor) {
      await nextFrame();
      this.scrollRoot.scrollTop = previousScrollTop;
      this.scheduleActiveHeadingUpdate();
    }

    this.setStatus(t('statusReloadedDocument', [doc.name || t('commonDocument')]), 'success');
  } catch (error) {
    this.clearViewerLoading();
    this.currentDoc = previousDoc;
    this.setDocumentReloadEnabled(true);
    this.setStatus(this.getLoadErrorMessage(error), 'error');
  }
}

async reloadDocumentSource(doc) {
  if (doc.sourceType === 'directory-file' && doc.path) {
    const { doc: reloadedDoc, node } = await this.directorySource.loadPath(doc.path);
    this.directoryTree.markActivePath(node.path);
    return reloadedDoc;
  }

  if (doc.handle) {
    const reloadedDoc = await this.fileSource.loadFromHandle(doc.handle);
    reloadedDoc.sourceType = doc.sourceType || 'file';
    return reloadedDoc;
  }

  if (doc.file) {
    const reloadedDoc = await this.fileSource.loadFromFile(doc.file);
    reloadedDoc.sourceType = doc.sourceType || 'file';
    return reloadedDoc;
  }

  if (doc.url) {
    return this.urlSource.load(doc.url);
  }

  throw new Error(t('errorCannotReload'));
}

setDocumentReloadEnabled(enabled) {
  if (!this.elements.reloadDocument) return;
  this.elements.reloadDocument.hidden = !enabled;
  this.elements.reloadDocument.disabled = !enabled;
}

  async createDirectoryDocument(fileNode) {
    const doc = await this.directorySource.loadFileNode(fileNode);
    doc.name = fileNode.name;
    doc.baseUrl = '';
    doc.sourceType = 'directory-file';
    doc.path = fileNode.path;
    return doc;
  }

  async openDocumentLink(link, sourceDoc) {
    const linkData = normalizeLinkData(link);
    let pendingDocument = null;

    try {
      if (linkData.kind === 'relative-document' && sourceDoc?.sourceType === 'directory-file') {
        const targetPath = this.directorySource.resolveRelativePath(sourceDoc.path, linkData.href);
        if (!targetPath) return;

        pendingDocument = {
          name: displayNameFromUrl(targetPath),
          path: targetPath
        };
        this.setViewerLoading();
        const { doc, node } = await this.directorySource.loadPath(targetPath);
        this.directoryTree.markActivePath(node.path);
        await this.renderDocument(doc, { anchor: extractHash(linkData.href) });
        return;
      }

      if (linkData.url) {
        await this.openUrl(linkData.url);
      }
    } catch (error) {
      if (error?.code === 'BINARY_FILE' && pendingDocument) {
        await this.clearViewerForFailedDocument(pendingDocument);
      } else {
        this.clearViewerLoading();
      }
      this.setStatus(this.getLoadErrorMessage(error), 'error');
    }
  }

  async renderDocument(doc, options = {}) {
    this.setViewerLoading(t('statusLoadingDocument', [doc.name || t('commonDocument')]));

    try {
      await this.saveCurrentScrollPosition();
      this.clearSourceLineHighlight();

      const format = doc.format || detectFormat(doc);
      const nextDocKey = this.getDocumentKey(doc);
      const outlineOptions = { openPopover: nextDocKey !== this.currentDocKey };
      if (nextDocKey !== this.currentDocKey && !options.anchor) this.clearUrlHash();
      const fileName = doc.name || t('docTitleUntitled');
      this.elements.title.textContent = fileName;
      document.title = `${fileName} - ${t('appName')}`;
      this.elements.scrollNav.hidden = false;
      this.elements.source.textContent = this.getDocumentSourceLabel(doc);
      this.elements.format.textContent = formatLabel(format);
      this.elements.preview.classList.toggle('source-code-body', format === FORMAT_IDS.SOURCE_CODE || format === FORMAT_IDS.TEXT || format === FORMAT_IDS.UNKNOWN);
      this.elements.preview.classList.toggle('diff-body', format === FORMAT_IDS.DIFF);

      if (format === FORMAT_IDS.SOURCE_CODE || format === FORMAT_IDS.TEXT || format === FORMAT_IDS.UNKNOWN) {
        if (!this.sourceRenderer) this.sourceRenderer = new SourceCodeRenderer();
        const sourceLanguage = format === FORMAT_IDS.TEXT || format === FORMAT_IDS.UNKNOWN
          ? 'plaintext'
          : doc.language || sourceLanguageFromPath(doc.name || doc.url || doc.path || '');
        if (sourceLanguage === 'html') this.elements.format.textContent = 'HTML';
        if (format === FORMAT_IDS.TEXT) {
          const lineEnding = detectLineEnding(doc.text || '');
          this.elements.format.textContent = `${formatLabel(format)} · ${lineEndingLabel(lineEnding)}`;
        }
        this.sourceRenderer.render(doc.text, this.elements.preview, {
          language: sourceLanguage,
          name: doc.name || '',
          url: doc.url || '',
          path: doc.path || ''
        });
        if (format === FORMAT_IDS.TEXT || format === FORMAT_IDS.UNKNOWN) {
          this.clearToc();
        } else {
          this.buildSourceSymbols(doc, sourceLanguage, outlineOptions);
          if (doc.sourceType !== 'directory-file' && this.headings.length) {
            this.applySidebarTab('outline');
            this.elements.sidebarTools.open = false;
          }
        }
        this.currentDoc = doc;
        this.currentDocKey = this.getDocumentKey(doc);
        this.showFileTab(doc);
        this.setDocumentReloadEnabled(true);
        await this.restoreOrResetScroll(doc, options);
        this.setStatus(
          format === FORMAT_IDS.UNKNOWN
            ? t('statusUnsupportedFormat', [format])
            : t('statusLoaded', [doc.name || (format === FORMAT_IDS.TEXT ? t('commonDocument') : t('commonSourceFile'))]),
          format === FORMAT_IDS.UNKNOWN ? 'error' : 'success'
        );
        return;
      }

      if (format === FORMAT_IDS.DIFF) {
        if (!this.diffRenderer) this.diffRenderer = new DiffRenderer();
        const diffOutline = this.diffRenderer.render(doc.text, this.elements.preview, {
          name: doc.name || '',
          url: doc.url || '',
          path: doc.path || ''
        });
        this.buildDiffOutline(diffOutline?.files || [], doc, outlineOptions);
        if (doc.sourceType !== 'directory-file' && diffOutline?.files?.length) {
          this.applySidebarTab('outline');
          this.elements.sidebarTools.open = false;
        }
        this.currentDoc = doc;
        this.currentDocKey = this.getDocumentKey(doc);
        this.showFileTab(doc);
        this.setDocumentReloadEnabled(true);
        await this.restoreOrResetScroll(doc, options);
        this.setStatus(t('statusLoaded', [doc.name || t('commonDiffFile')]), 'success');
        return;
      }

      await this.markdown.render(doc.text, this.elements.preview, {
        baseUrl: doc.baseUrl || doc.url || '',
        onOpenDocumentLink: linkedUrl => this.openDocumentLink(linkedUrl, doc)
      });
      ensureHeadingAnchors(this.elements.preview);
      this.buildToc(outlineOptions);
      this.updateTocTitle(doc);
      if (doc.sourceType !== 'directory-file' && this.headings.length) {
        this.applySidebarTab('outline');
        this.elements.sidebarTools.open = false;
      }

      this.currentDoc = doc;
      this.currentDocKey = this.getDocumentKey(doc);
      this.showFileTab(doc);
      this.setDocumentReloadEnabled(true);
      await this.restoreOrResetScroll(doc, options);
      this.setStatus(t('statusLoaded', [doc.name || t('commonDocument')]), 'success');
    } finally {
      this.clearViewerLoading();
    }
  }

  setViewerLoading(message) {
    const label = message || t('statusLoadingDocument', [t('commonDocument')]) || 'Loading document ...';
    this.elements.preview.classList.add('is-loading');
    this.elements.preview.dataset.loadingLabel = label;
    this.elements.preview.setAttribute('aria-busy', 'true');
  }

  clearViewerLoading() {
    this.elements.preview.classList.remove('is-loading');
    this.elements.preview.removeAttribute('aria-busy');
    delete this.elements.preview.dataset.loadingLabel;
  }

  setDirectoryTreeLoading(message = t('statusOpeningFolder')) {
    const label = message || t('statusOpeningFolder');
    this.elements.tree.classList.add('is-loading');
    this.elements.tree.dataset.loadingLabel = label;
    this.elements.tree.setAttribute('aria-busy', 'true');
  }

  clearDirectoryTreeLoading() {
    this.elements.tree.classList.remove('is-loading');
    this.elements.tree.removeAttribute('aria-busy');
    delete this.elements.tree.dataset.loadingLabel;
  }

  getDocumentKey(doc) {
    if (doc?.sourceType === 'directory-file' && doc.path) return `directory:${doc.path}`;
    if (doc?.url) return `url:${doc.url}`;
    if (doc?.path) return `path:${doc.path}`;
    if (doc?.name) return `file:${doc.name}`;
    return '';
  }

  clearUrlHash() {
    if (!window.location.hash) return;
    history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
  }

  getDocumentSourceLabel(doc) {
    if (!doc) return '';

    if (doc.url) return doc.url;
    if (doc.path) return doc.path;
    if (doc.relativePath) return doc.relativePath;
    if (doc.displayPath) return doc.displayPath;

    if (doc.sourceType === 'dropped-file') {
      return doc.name ? t('sourceDroppedFile', [doc.name]) : t('sourceDroppedFileGeneric');
    }

    if (doc.sourceType === 'file') {
      return doc.name ? t('sourceLocalFile', [doc.name]) : t('sourceLocalFileGeneric');
    }

    return doc.sourceType || '';
  }

  scheduleSaveScrollPosition() {
    if (!this.rememberScrollEnabled || !this.currentDocKey) return;
    clearTimeout(this.scrollSaveTimer);
    this.scrollSaveTimer = setTimeout(() => {
      this.saveCurrentScrollPosition().catch(() => {});
    }, 180);
  }

  async saveCurrentScrollPosition() {
    if (!this.rememberScrollEnabled || !this.currentDocKey) return;
    this.scrollPositions[this.currentDocKey] = {
      top: this.scrollRoot.scrollTop,
      updatedAt: Date.now()
    };
    await chrome.storage.session.set({ [SCROLL_POSITIONS_KEY]: this.scrollPositions });
  }

  async restoreOrResetScroll(doc, options = {}) {
    const docKey = this.getDocumentKey(doc);
    const anchor = options.anchor;

    await nextFrame();

    if (anchor && this.scrollToAnchor(anchor)) return;

    const saved = this.rememberScrollEnabled ? this.scrollPositions[docKey] : null;
    this.scrollRoot.scrollTop = Number.isFinite(saved?.top) ? saved.top : 0;
    this.scheduleActiveHeadingUpdate();
  }

  scrollToAnchor(anchor, options = {}) {
    const id = safeDecodeURIComponent(String(anchor || '').replace(/^#/, ''));
    if (!id) return false;
    const target = Array.from(this.elements.preview.querySelectorAll('[id]')).find(element => element.id === id) || Array.from(this.elements.preview.querySelectorAll('[name]')).find(element => element.getAttribute('name') === id);
    if (!target) return false;

    target.scrollIntoView({ block: 'start', behavior: options.smooth ? 'smooth' : 'auto' });
    this.setActiveHeading(target.id || id);

    if (options.updateHash) {
      const hash = encodeURIComponent(target.id || id);
      history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${hash}`);
    }

    return true;
  }

  handlePreviewAnchorClick(event) {
    const link = event.target.closest?.('a[href^="#"]');
    if (!link || !this.elements.preview.contains(link)) return;

    const href = link.getAttribute('href');
    if (!href || href === '#') return;

    if (this.scrollToAnchor(href, { smooth: true, updateHash: true })) {
      event.preventDefault();
      this.saveCurrentScrollPosition().catch(() => {});
    }
  }

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
  const symbols = extractSourceSymbols(doc.text || '', { language, name: doc.name || doc.url || doc.path || '' });
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
    row.dataset.tocText = `${heading.text || ''} ${heading.path || ''} ${heading.filePath || ''}`.toLowerCase();
    row.dataset.tocContext = context;

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'toc-disclosure';
    toggle.dataset.headingId = heading.id;
    toggle.dataset.tocContext = context;
    toggle.setAttribute('aria-label', t('a11yCollapseSection', [heading.text]));
    toggle.setAttribute('aria-expanded', 'true');
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

    const item = heading.kind === 'diff-directory'
      ? document.createElement('button')
      : document.createElement('a');

    item.className = 'toc-item';
    item.dataset.tocContext = context;
    item.title = heading.path || heading.text;

    if (heading.kind === 'diff-directory') {
      item.type = 'button';
      item.classList.add('toc-directory-item');
      item.innerHTML = `${tocIconSvg('folder')}<span class="toc-item-label"></span>`;
      item.querySelector('.toc-item-label').textContent = heading.text;
      item.addEventListener('click', event => {
        event.preventDefault();
        this.toggleTocGroup(heading.id);
      });
    } else if (heading.kind === 'diff-file') {
      item.href = `#${encodeURIComponent(heading.id)}`;
      item.innerHTML = `${tocIconSvg('file')}<span class="toc-item-label"></span><span class="toc-item-stats"></span>`;
      item.querySelector('.toc-item-label').textContent = heading.text;
      item.querySelector('.toc-item-stats').textContent = `+${heading.stats?.added || 0} −${heading.stats?.removed || 0}`;
      item.addEventListener('click', event => {
        event.preventDefault();
        this.scrollToAnchor(heading.id, { smooth: true, updateHash: true });
        this.saveCurrentScrollPosition().catch(() => {});
        if (context === 'popover' && !this.tocPopoverPinned) this.closeTocPopover();
      });
      this.registerTocItem(heading.id, item);
    } else if (heading.kind === 'source-symbol') {
      const anchorId = heading.anchorId || `L${heading.line}`;
      item.href = `#${encodeURIComponent(anchorId)}`;
      item.innerHTML = `<span class="toc-symbol-badge">${symbolKindLabel(heading.symbolKind)}</span><span class="toc-item-label"></span><span class="toc-symbol-line">L${heading.line}</span>`;
      item.querySelector('.toc-item-label').textContent = heading.text;
      item.addEventListener('click', event => {
        event.preventDefault();
        this.scrollToAnchor(anchorId, { smooth: true, updateHash: true });
        this.highlightSourceLine(anchorId);
        this.saveCurrentScrollPosition().catch(() => {});
        if (context === 'popover' && !this.tocPopoverPinned) this.closeTocPopover();
      });
      this.registerTocItem(heading.id, item);
    } else {
      item.href = `#${encodeURIComponent(heading.id)}`;
      item.textContent = heading.text;
      item.addEventListener('click', event => {
        event.preventDefault();
        this.scrollToAnchor(heading.id, { smooth: true, updateHash: true });
        this.saveCurrentScrollPosition().catch(() => {});
        if (context === 'popover' && !this.tocPopoverPinned) this.closeTocPopover();
      });
      this.registerTocItem(heading.id, item);
    }

    row.append(toggle, item);
    list.append(row);
  }

  const noMatch = document.createElement('div');
  noMatch.className = 'toc-empty toc-no-matches';
  noMatch.textContent = this.outlineType === 'diff' ? t('tocNoMatchingFiles') : this.outlineType === 'source' ? t('tocNoMatchingSymbols') : t('tocNoMatchingHeadings');
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
    this.tocFilterQuery = String(value || '').trim().toLowerCase();
    if (this.elements.tocFilter.value !== value) this.elements.tocFilter.value = value;
    if (this.elements.tocPopoverFilter.value !== value) this.elements.tocPopoverFilter.value = value;
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
            this.collectTocDescendantIds(node, visibleIds);
          }
        }
      }

      for (const row of rows) {
        const id = row.dataset.headingId;
        const node = this.headingTree.byId.get(id);
        let hidden = false;

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


collectTocDescendantIds(node, targetSet) {
  if (!node?.children?.length) return;
  for (const child of node.children) {
    targetSet.add(child.id);
    this.collectTocDescendantIds(child, targetSet);
  }
}

  updateTocDisclosureStates() {
    const query = this.tocFilterQuery;
    const matchedAncestorIds = new Set();

    if (query) {
      for (const heading of this.headingTree.nodes) {
        if (!`${heading.text || ''} ${heading.path || ''} ${heading.filePath || ''}`.toLowerCase().includes(query)) continue;
        for (const parentId of heading.parentIds) matchedAncestorIds.add(parentId);
      }
    }

    for (const container of [this.elements.tocTree, this.elements.tocPopoverTree]) {
      for (const toggle of container.querySelectorAll('.toc-disclosure:not(.is-placeholder)')) {
        const id = toggle.dataset.headingId;
        const expanded = query ? matchedAncestorIds.has(id) || !this.tocCollapsedIds.has(id) : !this.tocCollapsedIds.has(id);
        toggle.setAttribute('aria-expanded', String(expanded));
        const node = this.headingTree.byId.get(id);
        toggle.setAttribute('aria-label', t(expanded ? 'a11yCollapseSection' : 'a11yExpandSection', [node?.text || t('commonSection')]));
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

    const rootRect = this.scrollRoot.getBoundingClientRect();
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
    if (shouldScrollToc && panelItem && this.activeSidebarTab === 'outline' && !this.elements.outlinePanel.hidden && this.isTocItemVisible(panelItem)) {
      panelItem.scrollIntoView({ block: 'nearest' });
    }

    const popoverItem = currentItems.find(item => item.dataset.tocContext === 'popover');
    if (shouldScrollToc && popoverItem && this.tocPopoverOpen && this.isTocItemVisible(popoverItem)) {
      popoverItem.scrollIntoView({ block: 'nearest' });
    }
  }

  isTocItemVisible(item) {
    const row = item.closest('.toc-row');
    return Boolean(row && !row.hidden);
  }

  async refreshFileUrlAccessStatus() {
    const allowed = await isFileUrlAccessAllowed();
    this.elements.fileUrlCard.dataset.state = allowed ? 'enabled' : 'disabled';
    this.elements.fileUrlStatus.textContent = allowed
      ? t('fileUrlEnabledViewer')
      : t('fileUrlDisabledViewer');
    return allowed;
  }

  async openExtensionSettingsPage() {
    await openExtensionSettings();
    this.setStatus(t('statusSettingsOpened'), 'info');
  }

  async copySettingsUrl() {
    try {
      const url = await copyExtensionSettingsUrl();
      this.setStatus(t('statusCopiedSettingsLink', [url]), 'success');
    } catch (error) {
      this.setStatus(error?.message || String(error), 'error');
    }
  }

  highlightSourceLine(anchorId) {
    this.clearSourceLineHighlight();

    if (!anchorId) return;
    const target = this.elements.preview.querySelector(`#${CSS.escape(anchorId)}`);
    if (!target?.classList?.contains('source-line')) return;

    target.classList.add('is-symbol-highlighted');
  }

  clearSourceLineHighlight() {
    for (const line of this.elements.preview.querySelectorAll('.source-line.is-symbol-highlighted')) {
      line.classList.remove('is-symbol-highlighted');
    }
  }

  async showLoadError(error, url) {
    this.clearViewerLoading();
    const message = this.getLoadErrorMessage(error);
    if (url?.startsWith('file://')) {
      await this.refreshFileUrlAccessStatus();
      this.setStatus(t('errorFileUrlBlocked', [message]), 'error');
    } else {
      this.setStatus(message, 'error');
    }
  }

  getLoadErrorMessage(error) {
    if (error?.code === 'BINARY_FILE') {
      return t('errorBinaryFile', [error.fileName || t('commonDocument')]);
    }

    return error?.message || String(error);
  }

  setStatus(message, type = 'info') {
    this.elements.status.hidden = false;
    this.elements.status.className = `status ${type}`;
    this.elements.status.textContent = message;
  }
}


function tocIconSvg(kind) {
  if (kind === 'folder') {
    return getFolderClosedIcon('toc-item-icon toc-folder-icon');
  }

  return getFileIcon('toc-item-icon toc-file-icon');
}

function fileFromDroppedEntry(fileEntry) {
  return new Promise((resolve, reject) => {
    fileEntry.file(resolve, reject);
  });
}

function nextFrame() {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

// Guard auto-start so importing this module in tests (empty document) is a
// no-op; the real viewer page always has #app.
if (document.querySelector('#app')) {
  new DevFileViewerApp().start().catch(error => {
    const status = document.querySelector('#status');
    if (!status) return;
    status.hidden = false;
    status.className = 'status error';
    status.textContent = error?.message || String(error);
  });
}
