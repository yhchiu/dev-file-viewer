import { t } from '../../core/i18n/i18n.js';
import { FORMAT_IDS } from '../../core/format/fileTypes.js';
import { isLikelyBinaryFile } from '../../core/format/binarySniff.js';
import { isSupportedDroppedName, normalizeDroppedEntryPath } from '../viewerHelpers.js';

/** True when a drag event carries files (vs. text/other drag payloads). */
export function dragEventHasFiles(event) {
  return Array.from(event.dataTransfer?.types || []).includes('Files');
}

// Owns window-level drag-and-drop: the drop overlay, resolving the dropped item
// across the File System Access / webkitEntry / File APIs, and handing the result
// to the host to render (file) or load as a folder.
export class DropController {
  constructor(host) {
    this.host = host;
    this.elements = host.elements;
    this.dragDepth = 0;
  }

  bindEvents() {
    window.addEventListener('dragenter', event => this.handleWindowDragEnter(event));
    window.addEventListener('dragover', event => this.handleWindowDragOver(event));
    window.addEventListener('dragleave', event => this.handleWindowDragLeave(event));
    window.addEventListener('drop', event => this.handleWindowDrop(event));
  }

  handleWindowDragEnter(event) {
    if (!dragEventHasFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    this.dragDepth += 1;
    this.setDropOverlayVisible(true);
  }

  handleWindowDragOver(event) {
    if (!dragEventHasFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'copy';
    this.setDropOverlayVisible(true);
  }

  handleWindowDragLeave(event) {
    if (!dragEventHasFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    this.dragDepth = Math.max(0, this.dragDepth - 1);
    if (this.dragDepth === 0) this.setDropOverlayVisible(false);
  }

  async handleWindowDrop(event) {
    if (!dragEventHasFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    this.dragDepth = 0;
    this.setDropOverlayVisible(false);

    try {
      this.host.setStatus(t('statusOpeningDropped'), 'info');
      const item = await this.resolveDroppedItem(event.dataTransfer);
      if (!item) {
        this.host.setStatus(t('statusNoSupportedDropped'), 'warning');
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
        this.host.setViewerLoading(
          t('statusLoadingDocument', [item.handle.name || t('commonDocument')])
        );
        const file = await item.handle.getFile();
        const doc = await this.loadDroppedFileDocument(file, {
          handle: item.handle,
          forcePlainText: item.forcePlainText,
          displayPath: item.handle.name
        });
        await this.host.renderDocument(doc);
        return;
      }

      if (item.kind === 'file-entry') {
        this.host.setViewerLoading(
          t('statusLoadingDocument', [item.entry.name || t('commonDocument')])
        );
        const file = await fileFromDroppedEntry(item.entry);
        const doc = await this.loadDroppedFileDocument(file, {
          forcePlainText: item.forcePlainText,
          path: normalizeDroppedEntryPath(item.entry.fullPath || item.entry.name || file.name)
        });
        await this.host.renderDocument(doc);
        return;
      }

      if (item.kind === 'file') {
        const relativePath = item.file.webkitRelativePath || '';
        this.host.setViewerLoading(
          t('statusLoadingDocument', [relativePath || item.file.name || t('commonDocument')])
        );
        const doc = await this.loadDroppedFileDocument(item.file, {
          forcePlainText: item.forcePlainText,
          relativePath,
          displayPath: relativePath || item.file.name
        });
        await this.host.renderDocument(doc);
        return;
      }

      this.host.setStatus(t('statusNoSupportedDropped'), 'warning');
    } catch (error) {
      this.host.clearViewerLoading();
      this.host.clearDirectoryTreeLoading();
      this.host.setStatus(error?.message || String(error), 'error');
    }
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
    if (options.forcePlainText && (await isLikelyBinaryFile(file))) {
      throw new Error(t('errorDroppedBinary', [file.name]));
    }

    const doc = await this.host.fileSource.loadFromFile(
      file,
      options.handle ? { handle: options.handle } : {}
    );
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
    this.host.showDirectoryLoading(t('statusOpeningFolder'), handle?.name || '');
    const { tree } = await this.host.directorySource.loadDirectoryHandle(handle);
    this.host.renderDirectoryTree(tree);
    this.host.currentFolderLoaded = true;
    this.host.setFolderReloadEnabled(true);
    this.host.clearViewerForFolder(t('statusDroppedFolderLoaded'));
    this.elements.scrollMemoryCard.hidden = false;
    this.host.applySidebarTab('files');
    this.host.setStatus(t('statusDroppedFolderLoaded'), 'success');
  }

  async openDroppedDirectoryEntry(entry) {
    this.host.showDirectoryLoading(t('statusOpeningFolder'), entry?.name || '');
    const { tree } = await this.host.directorySource.loadDirectoryEntry(entry);
    this.host.renderDirectoryTree(tree);
    this.host.currentFolderLoaded = true;
    this.host.setFolderReloadEnabled(true);
    this.host.clearViewerForFolder(t('statusDroppedFolderLoaded'));
    this.elements.scrollMemoryCard.hidden = false;
    this.host.applySidebarTab('files');
    this.host.setStatus(t('statusDroppedFolderLoaded'), 'success');
  }
}

function fileFromDroppedEntry(fileEntry) {
  return new Promise((resolve, reject) => {
    fileEntry.file(resolve, reject);
  });
}
