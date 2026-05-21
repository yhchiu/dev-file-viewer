import { MarkdownEngine } from '../core/markdown/MarkdownEngine.js';
import { FORMAT_IDS, detectFormat, displayNameFromUrl } from '../core/format/fileTypes.js';
import { UrlSourceProvider } from '../core/sources/UrlSourceProvider.js';
import { FilePickerSourceProvider } from '../core/sources/FilePickerSourceProvider.js';
import { DirectorySourceProvider } from '../core/sources/DirectorySourceProvider.js';
import { DirectoryTreeView } from '../features/sidebar/DirectoryTreeView.js';
import { PluginRegistry } from '../plugins/PluginRegistry.js';
import { mermaidPlugin } from '../plugins/mermaidPlugin.js';
import { copyExtensionSettingsUrl, isFileUrlAccessAllowed, openExtensionSettings } from '../core/browser/fileUrlAccess.js';

const SCROLL_ENABLED_KEY = 'devFileViewer:rememberScrollEnabled';
const SCROLL_POSITIONS_KEY = 'devFileViewer:scrollPositions';
const SIDEBAR_COLLAPSED_KEY = 'devFileViewer:sidebarCollapsed';
const SIDEBAR_WIDTH_KEY = 'devFileViewer:sidebarWidth';
const DEFAULT_SIDEBAR_WIDTH = 310;
const MIN_SIDEBAR_WIDTH = 240;
const MAX_SIDEBAR_WIDTH = 560;

class DevFileViewerApp {
  constructor() {
    this.elements = {
      app: document.querySelector('#app'),
      sidebar: document.querySelector('#sidebar'),
      title: document.querySelector('#doc-title'),
      source: document.querySelector('#doc-source'),
      format: document.querySelector('#doc-format'),
      status: document.querySelector('#status'),
      preview: document.querySelector('#preview'),
      viewerMain: document.querySelector('#viewer-main'),
      sidebarTools: document.querySelector('#sidebar-tools'),
      sidebarToggle: document.querySelector('#btn-sidebar-toggle'),
      sidebarRestore: document.querySelector('#btn-sidebar-restore'),
      sidebarResizer: document.querySelector('#sidebar-resizer'),
      scrollMemoryCard: document.querySelector('#scroll-memory-card'),
      rememberScroll: document.querySelector('#remember-scroll'),
      openFile: document.querySelector('#btn-open-file'),
      openFolder: document.querySelector('#btn-open-folder'),
      openUrl: document.querySelector('#btn-open-url'),
      urlBox: document.querySelector('#url-box'),
      urlInput: document.querySelector('#url-input'),
      loadUrl: document.querySelector('#btn-load-url'),
      tree: document.querySelector('#directory-tree'),
      fileUrlCard: document.querySelector('#file-url-card'),
      fileUrlStatus: document.querySelector('#file-url-status'),
      openExtensionSettings: document.querySelector('#btn-open-extension-settings'),
      copySettingsLink: document.querySelector('#btn-copy-settings-link'),
      useOpenFile: document.querySelector('#btn-use-open-file')
    };

    this.plugins = new PluginRegistry([mermaidPlugin]);
    this.markdown = new MarkdownEngine(this.plugins);
    this.urlSource = new UrlSourceProvider();
    this.fileSource = new FilePickerSourceProvider();
    this.directorySource = new DirectorySourceProvider();
    this.directoryTree = new DirectoryTreeView(this.elements.tree);

    this.currentDoc = null;
    this.currentDocKey = '';
    this.rememberScrollEnabled = false;
    this.scrollPositions = {};
    this.scrollSaveTimer = 0;
    this.sidebarCollapsed = false;
    this.sidebarWidth = DEFAULT_SIDEBAR_WIDTH;
    this.resizeDrag = null;
  }

  async start() {
    await this.plugins.init();
    await this.restoreSidebarWidth();
    await this.restoreSidebarState();
    await this.restoreScrollSettings();
    this.bindEvents();
    await this.refreshFileUrlAccessStatus();
    await this.loadFromLaunchParams();
  }

  bindEvents() {
    this.elements.sidebarToggle.addEventListener('click', () => this.setSidebarCollapsed(true));
    this.elements.sidebarRestore.addEventListener('click', () => this.setSidebarCollapsed(false));
    this.elements.sidebarResizer.addEventListener('pointerdown', event => this.startSidebarResize(event));
    this.elements.sidebarResizer.addEventListener('keydown', event => this.handleSidebarResizeKey(event));
    this.elements.sidebarResizer.addEventListener('dblclick', () => this.resetSidebarWidth());
    this.elements.openFile.addEventListener('click', () => this.openLocalFile());
    this.elements.openFolder.addEventListener('click', () => this.openLocalFolder());
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
    this.elements.viewerMain.addEventListener('scroll', () => this.scheduleSaveScrollPosition(), { passive: true });
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
  }

  async resetSidebarWidth() {
    this.applySidebarWidth(DEFAULT_SIDEBAR_WIDTH);
    await this.persistSidebarWidth();
  }

  async restoreSidebarState() {
    const stored = await chrome.storage.local.get(SIDEBAR_COLLAPSED_KEY);
    await this.setSidebarCollapsed(Boolean(stored[SIDEBAR_COLLAPSED_KEY]), { persist: false });
  }

  async setSidebarCollapsed(collapsed, options = {}) {
    const shouldPersist = options.persist !== false;
    this.sidebarCollapsed = Boolean(collapsed);
    this.elements.app.classList.toggle('sidebar-collapsed', this.sidebarCollapsed);
    this.elements.sidebarRestore.hidden = !this.sidebarCollapsed;
    this.elements.sidebarResizer.setAttribute('aria-hidden', String(this.sidebarCollapsed));
    this.elements.sidebarResizer.tabIndex = this.sidebarCollapsed ? -1 : 0;
    this.elements.sidebarToggle.setAttribute('aria-expanded', String(!this.sidebarCollapsed));
    this.elements.sidebarToggle.setAttribute('aria-label', this.sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar');
    this.elements.sidebarToggle.title = this.sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar';
    this.elements.sidebar.setAttribute('aria-hidden', String(this.sidebarCollapsed));

    if (shouldPersist) {
      await chrome.storage.local.set({ [SIDEBAR_COLLAPSED_KEY]: this.sidebarCollapsed });
    }

    await nextFrame();
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
      this.setStatus('Scroll position memory is enabled for this browser session only.', 'info');
    } else {
      this.setStatus('Scroll position memory is disabled. Files will open at the first line.', 'info');
    }
  }

  async loadFromLaunchParams() {
    const params = new URLSearchParams(window.location.search);
    const snapshotId = params.get('snapshot');
    const url = params.get('url');

    if (snapshotId) {
      await this.openSnapshot(snapshotId);
      return;
    }

    if (url) await this.openUrl(url);
  }

  async openSnapshot(snapshotId) {
    const key = `sourceSnapshot:${snapshotId}`;
    const stored = await chrome.storage.session.get(key);
    const snapshot = stored[key];

    if (!snapshot) {
      throw new Error('The captured document is no longer available. Reopen the Markdown file or use Open File.');
    }

    const doc = {
      id: snapshot.url || snapshotId,
      name: displayNameFromUrl(snapshot.url || snapshot.title || 'Untitled'),
      sourceType: 'captured-url',
      baseUrl: snapshot.url || '',
      url: snapshot.url || '',
      mimeType: snapshot.mimeType || '',
      format: detectFormat({ url: snapshot.url || '', mimeType: snapshot.mimeType || '' }),
      text: snapshot.text || ''
    };

    await this.renderDocument(doc);
  }

  async openUrl(url) {
    if (!url) return;
    try {
      this.setStatus(`Loading ${url} ...`, 'info');
      const doc = await this.urlSource.load(url);
      await this.renderDocument(doc);
    } catch (error) {
      await this.showLoadError(error, url);
    }
  }

  async openLocalFile() {
    try {
      const doc = await this.fileSource.pickFile();
      await this.renderDocument(doc);
    } catch (error) {
      if (error?.name === 'AbortError') return;
      this.setStatus(error?.message || String(error), 'error');
    }
  }

  async openLocalFolder() {
    try {
      this.setStatus('Opening folder ...', 'info');
      const { tree } = await this.directorySource.pickDirectory();
      this.directoryTree.render(tree, async fileNode => {
        try {
          const doc = await this.createDirectoryDocument(fileNode);
          await this.renderDocument(doc);
        } catch (error) {
          this.setStatus(error?.message || String(error), 'error');
        }
      });
      this.elements.sidebarTools.open = false;
      this.elements.scrollMemoryCard.hidden = false;
      this.setStatus('Folder loaded. Select a Markdown file from the sidebar.', 'success');
    } catch (error) {
      if (error?.name === 'AbortError') return;
      this.directoryTree.showEmpty('Folder could not be opened.');
      this.setStatus(error?.message || String(error), 'error');
    }
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

    try {
      if (linkData.kind === 'relative-document' && sourceDoc?.sourceType === 'directory-file') {
        const targetPath = this.directorySource.resolveRelativePath(sourceDoc.path, linkData.href);
        if (!targetPath) return;

        const { doc, node } = await this.directorySource.loadPath(targetPath);
        this.directoryTree.markActivePath(node.path);
        await this.renderDocument(doc, { anchor: extractHash(linkData.href) });
        return;
      }

      if (linkData.url) {
        await this.openUrl(linkData.url);
      }
    } catch (error) {
      this.setStatus(error?.message || String(error), 'error');
    }
  }

  async renderDocument(doc, options = {}) {
    await this.saveCurrentScrollPosition();

    const format = doc.format || detectFormat(doc);
    this.elements.title.textContent = doc.name || 'Untitled';
    this.elements.source.textContent = doc.url || doc.path || doc.sourceType || '';
    this.elements.format.textContent = format === FORMAT_IDS.MARKDOWN ? 'Markdown' : format;

    if (format !== FORMAT_IDS.MARKDOWN) {
      this.elements.preview.textContent = doc.text || '';
      this.currentDoc = doc;
      this.currentDocKey = this.getDocumentKey(doc);
      await this.restoreOrResetScroll(doc, options);
      this.setStatus(`Unsupported format in V1: ${format}.`, 'error');
      return;
    }

    await this.markdown.render(doc.text, this.elements.preview, {
      baseUrl: doc.baseUrl || doc.url || '',
      onOpenDocumentLink: linkedUrl => this.openDocumentLink(linkedUrl, doc)
    });
    this.ensureHeadingAnchors();

    this.currentDoc = doc;
    this.currentDocKey = this.getDocumentKey(doc);
    await this.restoreOrResetScroll(doc, options);
    this.setStatus(`Loaded ${doc.name || 'document'}.`, 'success');
  }

  getDocumentKey(doc) {
    if (doc?.sourceType === 'directory-file' && doc.path) return `directory:${doc.path}`;
    if (doc?.url) return `url:${doc.url}`;
    if (doc?.path) return `path:${doc.path}`;
    if (doc?.name) return `file:${doc.name}`;
    return '';
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
      top: this.elements.viewerMain.scrollTop,
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
    this.elements.viewerMain.scrollTop = Number.isFinite(saved?.top) ? saved.top : 0;
  }

  scrollToAnchor(anchor) {
    const id = safeDecodeURIComponent(String(anchor || '').replace(/^#/, ''));
    if (!id) return false;
    const target = document.getElementById(id) || Array.from(this.elements.preview.querySelectorAll('[name]')).find(element => element.getAttribute('name') === id);
    if (!target) return false;
    target.scrollIntoView({ block: 'start' });
    return true;
  }

  ensureHeadingAnchors() {
    const used = new Set(Array.from(this.elements.preview.querySelectorAll('[id]')).map(element => element.id));
    for (const heading of this.elements.preview.querySelectorAll('h1, h2, h3, h4, h5, h6')) {
      if (heading.id) continue;
      const base = slugify(heading.textContent || 'section') || 'section';
      let slug = base;
      let index = 2;
      while (used.has(slug)) slug = `${base}-${index++}`;
      heading.id = slug;
      used.add(slug);
    }
  }

  async refreshFileUrlAccessStatus() {
    const allowed = await isFileUrlAccessAllowed();
    this.elements.fileUrlCard.dataset.state = allowed ? 'enabled' : 'disabled';
    this.elements.fileUrlStatus.textContent = allowed
      ? 'Enabled. file:// Markdown URLs can be opened automatically.'
      : 'Not enabled. Recommended: use Open File/Open Folder. Advanced: enable Chrome file URL access.';
    return allowed;
  }

  async openExtensionSettingsPage() {
    await openExtensionSettings();
    this.setStatus('Chrome opened the extension settings page. Enable “Allow access to file URLs”, then return here.', 'info');
  }

  async copySettingsUrl() {
    try {
      const url = await copyExtensionSettingsUrl();
      this.setStatus(`Copied settings link: ${url}`, 'success');
    } catch (error) {
      this.setStatus(error?.message || String(error), 'error');
    }
  }

  async showLoadError(error, url) {
    const message = String(error?.message || error);
    if (url?.startsWith('file://')) {
      await this.refreshFileUrlAccessStatus();
      this.setStatus(`${message}\n\nChrome blocks file:// URL access until you enable “Allow access to file URLs”. You can also use Open File or Open Folder without changing this Chrome setting.`, 'error');
    } else {
      this.setStatus(message, 'error');
    }
  }

  setStatus(message, type = 'info') {
    this.elements.status.hidden = false;
    this.elements.status.className = `status ${type}`;
    this.elements.status.textContent = message;
  }
}

function normalizeLinkData(link) {
  if (typeof link === 'string') return { href: link, url: link, kind: 'absolute-document' };
  return link || {};
}

function extractHash(href) {
  const value = String(href || '');
  const hashIndex = value.indexOf('#');
  return hashIndex >= 0 ? value.slice(hashIndex + 1) : '';
}

function safeDecodeURIComponent(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}


function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

function nextFrame() {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

new DevFileViewerApp().start().catch(error => {
  const status = document.querySelector('#status');
  status.hidden = false;
  status.className = 'status error';
  status.textContent = error?.message || String(error);
});
