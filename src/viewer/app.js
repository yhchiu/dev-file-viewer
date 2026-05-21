import { MarkdownEngine } from '../core/markdown/MarkdownEngine.js';
import { FORMAT_IDS, detectFormat, displayNameFromUrl } from '../core/format/fileTypes.js';
import { UrlSourceProvider } from '../core/sources/UrlSourceProvider.js';
import { FilePickerSourceProvider } from '../core/sources/FilePickerSourceProvider.js';
import { DirectorySourceProvider } from '../core/sources/DirectorySourceProvider.js';
import { DirectoryTreeView } from '../features/sidebar/DirectoryTreeView.js';
import { PluginRegistry } from '../plugins/PluginRegistry.js';
import { mermaidPlugin } from '../plugins/mermaidPlugin.js';
import { copyExtensionSettingsUrl, isFileUrlAccessAllowed, openExtensionSettings } from '../core/browser/fileUrlAccess.js';

class DevFileViewerApp {
  constructor() {
    this.elements = {
      title: document.querySelector('#doc-title'),
      source: document.querySelector('#doc-source'),
      format: document.querySelector('#doc-format'),
      status: document.querySelector('#status'),
      preview: document.querySelector('#preview'),
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
  }

  async start() {
    await this.plugins.init();
    this.bindEvents();
    await this.refreshFileUrlAccessStatus();
    await this.loadFromLaunchParams();
  }

  bindEvents() {
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
          const doc = await this.directorySource.loadFileNode(fileNode);
          doc.name = fileNode.name;
          doc.baseUrl = '';
          doc.sourceType = 'directory-file';
          doc.path = fileNode.path;
          await this.renderDocument(doc);
        } catch (error) {
          this.setStatus(error?.message || String(error), 'error');
        }
      });
      this.setStatus('Folder loaded. Select a Markdown file from the sidebar.', 'success');
    } catch (error) {
      if (error?.name === 'AbortError') return;
      this.directoryTree.showEmpty('Folder could not be opened.');
      this.setStatus(error?.message || String(error), 'error');
    }
  }

  async renderDocument(doc) {
    const format = doc.format || detectFormat(doc);
    this.elements.title.textContent = doc.name || 'Untitled';
    this.elements.source.textContent = doc.url || doc.path || doc.sourceType || '';
    this.elements.format.textContent = format === FORMAT_IDS.MARKDOWN ? 'Markdown' : format;

    if (format !== FORMAT_IDS.MARKDOWN) {
      this.elements.preview.textContent = doc.text || '';
      this.setStatus(`Unsupported format in V1: ${format}.`, 'error');
      return;
    }

    await this.markdown.render(doc.text, this.elements.preview, {
      baseUrl: doc.baseUrl || doc.url || '',
      onOpenDocumentLink: linkedUrl => this.openUrl(linkedUrl)
    });
    this.setStatus(`Loaded ${doc.name || 'document'}.`, 'success');
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

new DevFileViewerApp().start().catch(error => {
  const status = document.querySelector('#status');
  status.hidden = false;
  status.className = 'status error';
  status.textContent = error?.message || String(error);
});
