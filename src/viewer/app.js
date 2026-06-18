import { MarkdownEngine } from '../core/markdown/MarkdownEngine.js';
import {
  getFileIcon,
  getPinIcon,
  getPinFilledIcon,
  getArrowUpIcon,
  getArrowDownIcon
} from '../core/ui/icons.js';
import { SourceCodeRenderer } from '../core/source/SourceCodeRenderer.js';
import { DiffRenderer } from '../core/diff/DiffRenderer.js';
import {
  FORMAT_IDS,
  detectFormat,
  detectLineEnding,
  displayNameFromUrl,
  formatLabel,
  lineEndingLabel,
  sourceLanguageFromPath
} from '../core/format/fileTypes.js';
import { UrlSourceProvider } from '../core/sources/UrlSourceProvider.js';
import { FilePickerSourceProvider } from '../core/sources/FilePickerSourceProvider.js';
import { DirectorySourceProvider } from '../core/sources/DirectorySourceProvider.js';
import { DirectoryTreeView } from '../features/sidebar/DirectoryTreeView.js';
import { PluginRegistry } from '../plugins/PluginRegistry.js';
import { mermaidPlugin } from '../plugins/mermaidPlugin.js';
import {
  copyExtensionSettingsUrl,
  isFileUrlAccessAllowed,
  openExtensionSettings
} from '../core/browser/fileUrlAccess.js';
import { ensureHeadingAnchors } from '../core/toc/headingIndex.js';
import { localizeDocument, t } from '../core/i18n/i18n.js';
import { extractHash, normalizeLinkData, safeDecodeURIComponent } from './viewerHelpers.js';
import { nextFrame } from './domUtils.js';
import { AppearanceController } from './controllers/AppearanceController.js';
import { ScrollMemoryController } from './controllers/ScrollMemoryController.js';
import { DropController } from './controllers/DropController.js';
import { SidebarController } from './controllers/SidebarController.js';
import { OutlineController } from './controllers/OutlineController.js';

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
      viewerLoading: document.querySelector('#viewer-loading'),
      viewerLoadingLabel: document.querySelector('#viewer-loading-label'),
      activityRail: document.querySelector('.activity-rail'),
      sidebarBody: document.querySelector('.sidebar-body'),
      sidebarPanels: document.querySelectorAll('[data-sidebar-panel]'),
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
      directoryRootName: document.querySelector('#directory-root-name'),
      fileUrlCard: document.querySelector('#file-url-card'),
      fileUrlStatus: document.querySelector('#file-url-status'),
      openExtensionSettings: document.querySelector('#btn-open-extension-settings'),
      copySettingsLink: document.querySelector('#btn-copy-settings-link'),
      useOpenFile: document.querySelector('#btn-use-open-file'),
      contentWidth: document.querySelector('#content-width-select'),
      theme: document.querySelector('#theme-select'),
      manageAutoOpen: document.querySelector('#btn-manage-auto-open'),
      viewerFontSizeRange: document.querySelector('#viewer-font-size-range'),
      viewerFontSizeInput: document.querySelector('#viewer-font-size-input'),
      activityRailButtons: document.querySelectorAll('[data-rail-target]'),
      fileTabs: document.querySelector('#file-tabs'),
      fileTabsViewport: document.querySelector('#file-tabs-viewport'),
      fileTabsList: document.querySelector('#file-tabs-list'),
      fileTabsScrollLeft: document.querySelector('#btn-file-tabs-scroll-left'),
      fileTabsScrollRight: document.querySelector('#btn-file-tabs-scroll-right'),
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

    this.appearance = new AppearanceController(this);
    this.scrollMemory = new ScrollMemoryController(this);
    this.drop = new DropController(this);
    this.sidebar = new SidebarController(this);
    this.outline = new OutlineController(this);

    this.currentDoc = null;
    this.currentDocKey = '';
    this.openTabs = [];
    this.openTabsByKey = new Map();
    this.activeTabKey = '';
    this.fileTabDrag = null;
    this.fileTabsOverflowFrame = 0;
    this.fileTabsScrollAnimationFrame = 0;
    this.ignoreNextFileTabClick = false;
    this.currentFolderLoaded = false;
    this.currentFolderName = '';
  }

  get scrollRoot() {
    return this.elements.viewerScroll || this.elements.viewerMain;
  }

  async start() {
    localizeDocument();
    this.showLaunchLoadingIfPending();
    await this.plugins.init();
    await this.appearance.restore();
    await this.sidebar.restore();
    await this.outline.restore();
    this.sidebar.applySidebarTab('files', { showPanel: false });
    this.sidebar.setSidebarPanel('open', { activeTarget: 'open-file' });
    await this.scrollMemory.restore();
    this.bindEvents();
    await this.refreshFileUrlAccessStatus();
    await this.loadFromLaunchParams();
  }

  bindEvents() {
    this.elements.openFile.addEventListener('click', () => {
      this.sidebar.setSidebarPanel('open', { activeTarget: 'open-file' });
      this.openLocalFile();
    });
    this.elements.reloadDocument.addEventListener('click', () => this.reloadCurrentDocument());
    this.elements.openFolder.addEventListener('click', () => {
      this.sidebar.setSidebarPanel('open', { activeTarget: 'open-folder' });
      this.openLocalFolder();
    });
    this.elements.reloadFolder.addEventListener('click', () => this.reloadCurrentFolder());
    this.elements.openUrl.addEventListener('click', () => {
      this.sidebar.setSidebarPanel('open', { activeTarget: 'open-url' });
      this.elements.urlBox.hidden = !this.elements.urlBox.hidden;
      if (!this.elements.urlBox.hidden) this.elements.urlInput.focus();
    });
    this.elements.loadUrl.addEventListener('click', () =>
      this.openUrl(this.elements.urlInput.value.trim())
    );
    this.elements.urlInput.addEventListener('keydown', event => {
      if (event.key === 'Enter') this.openUrl(this.elements.urlInput.value.trim());
    });
    this.elements.openExtensionSettings.addEventListener('click', () =>
      this.openExtensionSettingsPage()
    );
    this.elements.copySettingsLink.addEventListener('click', () => this.copySettingsUrl());
    this.elements.useOpenFile.addEventListener('click', () => {
      this.sidebar.setSidebarPanel('open', { activeTarget: 'open-file' });
      this.openLocalFile();
    });
    this.elements.manageAutoOpen?.addEventListener('click', () => chrome.runtime.openOptionsPage());
    this.appearance.bindEvents();
    this.scrollMemory.bindEvents();
    this.drop.bindEvents();
    this.sidebar.bindEvents();
    this.outline.bindEvents();
    window.addEventListener('resize', () => {
      this.outline.reflowFloatingTocPosition();
      this.scheduleUpdateFileTabsOverflowState();
    });
    this.elements.fileTabsScrollLeft?.addEventListener('click', () => this.scrollFileTabs(-1));
    this.elements.fileTabsScrollRight?.addEventListener('click', () => this.scrollFileTabs(1));
    this.elements.fileTabsList?.addEventListener(
      'scroll',
      () => this.updateFileTabsOverflowState(),
      { passive: true }
    );
    this.elements.fileTabsViewport?.addEventListener(
      'wheel',
      event => this.handleFileTabsWheel(event),
      { passive: false }
    );
    this.elements.preview.addEventListener('click', event => this.handlePreviewAnchorClick(event));
    this.scrollRoot.addEventListener(
      'scroll',
      () => {
        this.saveActiveTabRuntimeScroll();
        this.scrollMemory.scheduleSaveScrollPosition();
        this.outline.scheduleActiveHeadingUpdate();
      },
      { passive: true }
    );

    // Set SVG content for scroll buttons
    // eslint-disable-next-line no-unsanitized/property -- trusted static SVG icon
    this.elements.btnScrollTop.innerHTML = getArrowUpIcon('scroll-nav-icon');
    // eslint-disable-next-line no-unsanitized/property -- trusted static SVG icon
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

  setDirectoryRootName(name) {
    this.currentFolderName = String(name || '').trim();
    if (!this.elements.directoryRootName) return;

    this.elements.directoryRootName.textContent = this.currentFolderName
      ? `(${this.currentFolderName})`
      : '';
    this.elements.directoryRootName.title = this.currentFolderName;
    this.elements.directoryRootName.hidden = !this.currentFolderName;
  }

  showDirectoryLoading(message = t('statusOpeningFolder'), folderName = '') {
    if (folderName) this.setDirectoryRootName(folderName);
    if (this.sidebar.sidebarCollapsed) {
      this.sidebar.setSidebarCollapsed(false).catch(() => {});
    }
    this.sidebar.applySidebarTab('files');
    this.setDirectoryTreeLoading(message);
  }

  showLaunchLoadingIfPending() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('snapshot') || params.get('url')) {
      // Show the loader right away so an auto-opened document does not sit on a
      // blank screen during cold-start init (plugins, settings) before render.
      this.setViewerLoading();
    }
  }

  async loadFromLaunchParams() {
    const params = new URLSearchParams(window.location.search);
    const snapshotId = params.get('snapshot');
    const url = params.get('url');

    if (snapshotId) {
      await this.openSnapshot(snapshotId, { anchor: extractHash(window.location.hash) });
      return;
    }

    if (url)
      await this.openUrl(url, { anchor: extractHash(window.location.hash) || extractHash(url) });
  }

  async openSnapshot(snapshotId, options = {}) {
    const key = `sourceSnapshot:${snapshotId}`;
    const stored = await chrome.storage.session.get(key);
    const snapshot = stored[key];

    if (!snapshot) {
      this.clearViewerLoading();
      throw new Error(t('errorSnapshotUnavailable'));
    }

    const doc = {
      id: snapshot.url || snapshotId,
      name: displayNameFromUrl(snapshot.url || snapshot.title || 'Untitled'),
      sourceType: 'captured-url',
      baseUrl: snapshot.url || '',
      url: snapshot.url || '',
      mimeType: snapshot.mimeType || '',
      format:
        snapshot.format ||
        detectFormat({ url: snapshot.url || '', mimeType: snapshot.mimeType || '' }),
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
        onLoadStart: name =>
          this.setViewerLoading(t('statusLoadingDocument', [name || t('commonDocument')]))
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
        onLoadStart: name => {
          this.showDirectoryLoading(t('statusOpeningFolder'), name);
        }
      });
      this.renderDirectoryTree(tree);
      this.currentFolderLoaded = true;
      this.setFolderReloadEnabled(true);
      this.clearViewerForFolder(t('statusFolderLoaded'));
      this.elements.scrollMemoryCard.hidden = false;
      this.sidebar.applySidebarTab('files');
      this.setStatus(t('statusFolderLoaded'), 'success');
    } catch (error) {
      this.clearDirectoryTreeLoading();
      if (error?.name === 'AbortError') return;
      this.currentFolderLoaded = false;
      this.setDirectoryRootName('');
      this.setFolderReloadEnabled(false);
      this.directoryTree.showEmpty(t('statusFolderCouldNotOpen'));
      this.setStatus(error?.message || String(error), 'error');
    }
  }

  clearViewerForFolder(message = t('statusSelectFromSidebar')) {
    this.clearAllFileTabs();
    this.currentDoc = null;
    this.currentDocKey = '';
    this.clearViewerLoading();
    this.clearSourceLineHighlight();
    this.outline.clearToc();
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
    this.saveActiveTabRuntimeScroll();
    await this.scrollMemory.saveCurrentScrollPosition();
    this.clearViewerLoading();
    if (this.currentDoc) {
      this.setDocumentReloadEnabled(true);
      return;
    }

    const path = fileNode.path || fileNode.displayPath || fileNode.name || '';
    const name = fileNode.name || (path ? displayNameFromUrl(path) : t('titleNoFileSelected'));

    this.currentDoc = null;
    this.currentDocKey = '';
    this.activeTabKey = '';
    this.renderFileTabs();
    this.clearSourceLineHighlight();
    this.outline.clearToc();
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

  async closeFileTab(key = this.activeTabKey) {
    const tabKey = key || this.currentDocKey;
    const tabIndex = this.openTabs.findIndex(tab => tab.key === tabKey);
    if (tabIndex < 0) return;

    const wasActive = tabKey === this.activeTabKey;
    if (wasActive && this.currentDoc) {
      this.saveActiveTabRuntimeScroll();
      await this.scrollMemory.saveCurrentScrollPosition();
    }

    this.openTabs.splice(tabIndex, 1);
    this.openTabsByKey.delete(tabKey);

    if (!this.openTabs.length) {
      this.clearViewerForNoDocument();
      this.setStatus(t('statusNoDocumentLoaded'), 'info');
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

  clearViewerForNoDocument(message = t('docSourceEmpty')) {
    this.clearAllFileTabs();
    this.currentDoc = null;
    this.currentDocKey = '';
    this.clearViewerLoading();
    this.clearSourceLineHighlight();
    this.outline.clearToc();
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

  upsertFileTab(doc, key = this.getDocumentKey(doc)) {
    if (!key) return null;

    let tab = this.openTabsByKey.get(key);
    if (!tab) {
      tab = {
        key,
        doc,
        title: this.getFileTabTitle(doc),
        sourceLabel: this.getDocumentSourceLabel(doc),
        pinned: false,
        scrollTop: null
      };
      this.openTabs.push(tab);
      this.openTabsByKey.set(key, tab);
    } else {
      tab.doc = doc;
      tab.title = this.getFileTabTitle(doc);
      tab.sourceLabel = this.getDocumentSourceLabel(doc);
    }

    this.activeTabKey = key;
    this.renderFileTabs();
    this.scrollActiveFileTabIntoView();
    return tab;
  }

  activateRenderedDocument(doc, key = this.getDocumentKey(doc)) {
    this.currentDoc = doc;
    this.currentDocKey = key;
    this.upsertFileTab(doc, key);
    this.setDocumentReloadEnabled(true);

    if (doc.sourceType === 'directory-file' && doc.path) {
      this.directoryTree.markActivePath(doc.path);
    }
  }

  getFileTabTitle(doc) {
    return doc?.name || t('docTitleUntitled');
  }

  saveActiveTabRuntimeScroll() {
    const tabKey = this.activeTabKey || this.currentDocKey;
    const tab = this.openTabsByKey.get(tabKey);
    if (!tab) return;
    tab.scrollTop = this.scrollRoot.scrollTop;
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
    if (key === this.activeTabKey && this.currentDoc) {
      this.scrollActiveFileTabIntoView();
      return;
    }

    await this.renderDocument(tab.doc, {
      scrollTop: Number.isFinite(tab.scrollTop) ? tab.scrollTop : null
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
          this.clearViewerLoading();
          this.setStatus(this.getLoadErrorMessage(error), 'error');
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
      this.clearViewerLoading();
      this.setStatus(this.getLoadErrorMessage(error), 'error');
    });
  }

  handleFileTabKeydown(event, key) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.activateFileTab(key).catch(error => {
        this.clearViewerLoading();
        this.setStatus(this.getLoadErrorMessage(error), 'error');
      });
      return;
    }

    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault();
      this.closeFileTab(key).catch(error => {
        this.clearViewerLoading();
        this.setStatus(this.getLoadErrorMessage(error), 'error');
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
      moved: false
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

    drag.moved = true;
    event.preventDefault();
    this.elements.fileTabs?.classList.add('is-tab-dragging');

    const targetTab = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest('.file-tab[data-tab-key]');
    if (!targetTab || !this.elements.fileTabsList?.contains(targetTab)) {
      this.renderFileTabs();
      return;
    }

    const moved = this.moveFileTabByPointer(
      drag.key,
      targetTab.dataset.tabKey,
      event.clientX,
      targetTab.getBoundingClientRect()
    );
    if (moved) this.renderFileTabs();
  }

  finishFileTabDrag(event) {
    const moved = Boolean(this.fileTabDrag?.moved);
    this.fileTabDrag = null;
    this.elements.fileTabs?.classList.remove('is-tab-dragging');

    if (moved) {
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

  moveFileTabByPointer(dragKey, targetKey, clientX, targetRect) {
    if (!dragKey || !targetKey || dragKey === targetKey) return false;

    const draggedTab = this.openTabsByKey.get(dragKey);
    const targetTab = this.openTabsByKey.get(targetKey);
    if (!draggedTab || !targetTab || draggedTab.pinned !== targetTab.pinned) return false;

    const fromIndex = this.openTabs.findIndex(tab => tab.key === dragKey);
    const targetIndex = this.openTabs.findIndex(tab => tab.key === targetKey);
    if (fromIndex < 0 || targetIndex < 0) return false;

    const insertAfter = clientX > targetRect.left + targetRect.width / 2;
    let insertIndex = targetIndex + (insertAfter ? 1 : 0);
    const [tab] = this.openTabs.splice(fromIndex, 1);
    if (fromIndex < insertIndex) insertIndex -= 1;

    insertIndex = this.clampFileTabInsertIndex(insertIndex, tab.pinned);
    this.openTabs.splice(insertIndex, 0, tab);
    return true;
  }

  clampFileTabInsertIndex(index, pinned) {
    const bounds = this.getFileTabGroupBounds(pinned);
    return Math.max(bounds.start, Math.min(bounds.end, index));
  }

  getFileTabGroupBounds(pinned) {
    const firstUnpinnedIndex = this.openTabs.findIndex(tab => !tab.pinned);
    if (pinned) {
      return {
        start: 0,
        end: firstUnpinnedIndex === -1 ? this.openTabs.length : firstUnpinnedIndex
      };
    }

    return {
      start: firstUnpinnedIndex === -1 ? this.openTabs.length : firstUnpinnedIndex,
      end: this.openTabs.length
    };
  }

  renderDirectoryTree(tree) {
    this.setDirectoryRootName(tree?.name || this.currentFolderName);
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
      this.showDirectoryLoading(t('statusReloadingFolder'), this.currentFolderName);
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
      this.setStatus(
        t('statusReloadingDocument', [previousDoc.name || t('commonDocument')]),
        'info'
      );

      const doc = await this.reloadDocumentSource(previousDoc);
      await this.renderDocument(doc, hashAnchor ? { anchor: hashAnchor } : {});

      if (!hashAnchor) {
        await nextFrame();
        this.scrollRoot.scrollTop = previousScrollTop;
        this.outline.scheduleActiveHeadingUpdate();
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
    await nextFrame();

    try {
      this.saveActiveTabRuntimeScroll();
      await this.scrollMemory.saveCurrentScrollPosition();
      this.clearSourceLineHighlight();

      const format = doc.format || detectFormat(doc);
      const nextDocKey = this.getDocumentKey(doc);
      const outlineOptions = { openPopover: nextDocKey !== this.currentDocKey };
      const runtimeScrollTop = this.getRuntimeScrollTopForDocument(nextDocKey, options);
      const scrollOptions =
        runtimeScrollTop === null ? options : { ...options, scrollTop: runtimeScrollTop };
      if (nextDocKey !== this.currentDocKey && !options.anchor) this.clearUrlHash();
      const fileName = doc.name || t('docTitleUntitled');
      this.elements.title.textContent = fileName;
      document.title = `${fileName} - ${t('appName')}`;
      this.elements.scrollNav.hidden = false;
      this.elements.source.textContent = this.getDocumentSourceLabel(doc);
      this.elements.format.textContent = formatLabel(format);
      this.elements.preview.classList.toggle(
        'source-code-body',
        format === FORMAT_IDS.SOURCE_CODE ||
          format === FORMAT_IDS.TEXT ||
          format === FORMAT_IDS.UNKNOWN
      );
      this.elements.preview.classList.toggle('diff-body', format === FORMAT_IDS.DIFF);

      if (
        format === FORMAT_IDS.SOURCE_CODE ||
        format === FORMAT_IDS.TEXT ||
        format === FORMAT_IDS.UNKNOWN
      ) {
        if (!this.sourceRenderer) this.sourceRenderer = new SourceCodeRenderer();
        const sourceLanguage =
          format === FORMAT_IDS.TEXT || format === FORMAT_IDS.UNKNOWN
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
          this.outline.clearToc();
        } else {
          this.outline.buildSourceSymbols(doc, sourceLanguage, outlineOptions);
          if (doc.sourceType !== 'directory-file' && this.outline.headings.length) {
            this.sidebar.applySidebarTab('outline');
          }
        }
        this.activateRenderedDocument(doc, nextDocKey);
        await this.scrollMemory.restoreOrResetScroll(doc, scrollOptions);
        this.setStatus(
          format === FORMAT_IDS.UNKNOWN
            ? t('statusUnsupportedFormat', [format])
            : t('statusLoaded', [
                doc.name ||
                  (format === FORMAT_IDS.TEXT ? t('commonDocument') : t('commonSourceFile'))
              ]),
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
        this.outline.buildDiffOutline(diffOutline?.files || [], doc, outlineOptions);
        if (doc.sourceType !== 'directory-file' && diffOutline?.files?.length) {
          this.sidebar.applySidebarTab('outline');
        }
        this.activateRenderedDocument(doc, nextDocKey);
        await this.scrollMemory.restoreOrResetScroll(doc, scrollOptions);
        this.setStatus(t('statusLoaded', [doc.name || t('commonDiffFile')]), 'success');
        return;
      }

      await this.markdown.render(doc.text, this.elements.preview, {
        baseUrl: doc.baseUrl || doc.url || '',
        onOpenDocumentLink: linkedUrl => this.openDocumentLink(linkedUrl, doc)
      });
      ensureHeadingAnchors(this.elements.preview);
      this.outline.buildToc(outlineOptions);
      this.outline.updateTocTitle(doc);
      if (doc.sourceType !== 'directory-file' && this.outline.headings.length) {
        this.sidebar.applySidebarTab('outline');
      }

      this.activateRenderedDocument(doc, nextDocKey);
      await this.scrollMemory.restoreOrResetScroll(doc, scrollOptions);
      this.setStatus(t('statusLoaded', [doc.name || t('commonDocument')]), 'success');
    } finally {
      this.clearViewerLoading();
    }
  }

  setViewerLoading(message) {
    const label =
      message || t('statusLoadingDocument', [t('commonDocument')]) || 'Loading document ...';
    this.elements.preview.classList.add('is-loading');
    this.elements.preview.dataset.loadingLabel = label;
    this.elements.preview.setAttribute('aria-busy', 'true');
    if (this.elements.viewerLoadingLabel) this.elements.viewerLoadingLabel.textContent = label;
    if (this.elements.viewerLoading) {
      this.elements.viewerLoading.hidden = false;
      this.elements.viewerLoading.removeAttribute('aria-hidden');
    }
  }

  clearViewerLoading() {
    this.elements.preview.classList.remove('is-loading');
    this.elements.preview.removeAttribute('aria-busy');
    delete this.elements.preview.dataset.loadingLabel;
    if (this.elements.viewerLoading) {
      this.elements.viewerLoading.hidden = true;
      this.elements.viewerLoading.setAttribute('aria-hidden', 'true');
    }
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
    if (doc?.relativePath) return `relative:${doc.relativePath}`;
    if (doc?.displayPath) return `display:${doc.displayPath}`;
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

  scrollToAnchor(anchor, options = {}) {
    const id = safeDecodeURIComponent(String(anchor || '').replace(/^#/, ''));
    if (!id) return false;
    const target =
      Array.from(this.elements.preview.querySelectorAll('[id]')).find(
        element => element.id === id
      ) ||
      Array.from(this.elements.preview.querySelectorAll('[name]')).find(
        element => element.getAttribute('name') === id
      );
    if (!target) return false;

    target.scrollIntoView({ block: 'start', behavior: options.smooth ? 'smooth' : 'auto' });
    this.outline.setActiveHeading(target.id || id);

    if (options.updateHash) {
      const hash = encodeURIComponent(target.id || id);
      history.replaceState(
        null,
        '',
        `${window.location.pathname}${window.location.search}#${hash}`
      );
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
      this.scrollMemory.saveCurrentScrollPosition().catch(() => {});
    }
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
    for (const line of this.elements.preview.querySelectorAll(
      '.source-line.is-symbol-highlighted'
    )) {
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

// Guard auto-start so importing this module in tests (empty document) is a
// no-op; the real viewer page always has #app.
if (document.querySelector('#app')) {
  new DevFileViewerApp().start().catch(error => {
    const loading = document.querySelector('#viewer-loading');
    if (loading) {
      loading.hidden = true;
      loading.setAttribute('aria-hidden', 'true');
    }
    const status = document.querySelector('#status');
    if (!status) return;
    status.hidden = false;
    status.className = 'status error';
    status.textContent = error?.message || String(error);
  });
}
