import { isLikelyBinaryFile } from '../format/binarySniff.js';
import { FilePickerSourceProvider } from './FilePickerSourceProvider.js';

const MAX_FILES = 2000;

export class DirectorySourceProvider {
  constructor() {
    this.fileProvider = new FilePickerSourceProvider();
    this.rootHandle = null;
    this.rootEntry = null;
    this.tree = null;
    this.fileIndex = new Map();
  }

  async pickDirectory(options = {}) {
    if (!('showDirectoryPicker' in window)) {
      throw new Error('This browser does not support folder picker. Use Chrome or Chromium-based browsers.');
    }

    const directoryHandle = await window.showDirectoryPicker({ mode: 'read' });
    options.onLoadStart?.(directoryHandle.name);
    return this.loadDirectoryHandle(directoryHandle);
  }


async loadDirectoryHandle(directoryHandle) {
  this.rootHandle = directoryHandle;
  this.rootEntry = null;
  this.tree = await this.buildTree(directoryHandle);
  this.fileIndex = new Map();
  this.indexTree(this.tree);
  return { rootHandle: this.rootHandle, tree: this.tree };
}

async loadDirectoryEntry(directoryEntry) {
  this.rootHandle = null;
  this.rootEntry = directoryEntry;
  this.tree = await this.buildEntryTree(directoryEntry);
  this.fileIndex = new Map();
  this.indexTree(this.tree);
  return { rootEntry: this.rootEntry, tree: this.tree };
}

async reloadDirectory() {
  if (this.rootHandle) return this.loadDirectoryHandle(this.rootHandle);
  if (this.rootEntry) return this.loadDirectoryEntry(this.rootEntry);
  throw new Error('No folder is currently open.');
}

  async buildTree(directoryHandle, path = '') {
    const node = {
      type: 'directory',
      name: directoryHandle.name,
      path,
      handle: directoryHandle,
      children: []
    };

    let count = 0;
    for await (const [name, handle] of directoryHandle.entries()) {
      if (count++ >= MAX_FILES) break;
      if (name.startsWith('.')) continue;

      const childPath = path ? `${path}/${name}` : name;
      if (handle.kind === 'directory') {
        node.children.push(await this.buildTree(handle, childPath));
      } else if (handle.kind === 'file') {
        node.children.push({
          type: 'file',
          name,
          path: childPath,
          handle
        });
      }
    }

    node.children.sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });
    return node;
  }

async buildEntryTree(directoryEntry, path = '') {
  const node = {
    type: 'directory',
    name: directoryEntry.name,
    path,
    entry: directoryEntry,
    children: []
  };

  const entries = await readDirectoryEntries(directoryEntry);
  let count = 0;
  for (const entry of entries) {
    if (count++ >= MAX_FILES) break;
    if (entry.name.startsWith('.')) continue;

    const childPath = path ? `${path}/${entry.name}` : entry.name;
    if (entry.isDirectory) {
      node.children.push(await this.buildEntryTree(entry, childPath));
    } else if (entry.isFile) {
      node.children.push({
        type: 'file',
        name: entry.name,
        path: childPath,
        entry
      });
    }
  }

  node.children.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });
  return node;
}

  indexTree(node) {
    if (!node) return;
    if (node.type === 'file') {
      this.fileIndex.set(node.path, node);
      return;
    }
    for (const child of node.children || []) this.indexTree(child);
  }

  async loadFileNode(fileNode) {
    if (fileNode.handle) {
      const file = await fileNode.handle.getFile();
      return this.loadTextFile(file, { handle: fileNode.handle, name: fileNode.name });
    }

    if (fileNode.file) return this.loadTextFile(fileNode.file, { name: fileNode.name });

    if (fileNode.entry) {
      const file = await fileFromEntry(fileNode.entry);
      return this.loadTextFile(file, { name: fileNode.name });
    }
    throw new Error(`Unable to load file: ${fileNode?.name || 'unknown'}`);
  }

  async loadTextFile(file, extra = {}) {
    if (await isLikelyBinaryFile(file)) {
      const fileName = extra.name || file?.name || 'unknown';
      const error = new Error(`File appears to be binary and cannot be opened as text: ${fileName}`);
      error.code = 'BINARY_FILE';
      error.fileName = fileName;
      throw error;
    }

    return this.fileProvider.loadFromFile(file, extra.handle ? { handle: extra.handle } : {});
  }

  async loadPath(path) {
    const node = this.fileIndex.get(path);
    if (!node) {
      throw new Error(`Linked file was not found in the opened folder: ${path}`);
    }
    const doc = await this.loadFileNode(node);
    doc.name = node.name;
    doc.baseUrl = '';
    doc.sourceType = 'directory-file';
    doc.path = node.path;
    return { doc, node };
  }

  resolveRelativePath(fromPath, href) {
    const cleanHref = stripQueryAndHash(String(href || ''));
    if (!cleanHref) return '';

    const decodedHref = safeDecodeURIComponent(cleanHref).replace(/\\/g, '/');
    const baseParts = String(fromPath || '').split('/').filter(Boolean);
    baseParts.pop();

    const parts = decodedHref.startsWith('/') ? [] : baseParts;
    for (const segment of decodedHref.split('/')) {
      if (!segment || segment === '.') continue;
      if (segment === '..') {
        parts.pop();
        continue;
      }
      parts.push(segment);
    }
    return parts.join('/');
  }
}

function readDirectoryEntries(directoryEntry) {
  return new Promise((resolve, reject) => {
    const reader = directoryEntry.createReader();
    const entries = [];

    const readBatch = () => {
      reader.readEntries(batch => {
        if (!batch.length) {
          resolve(entries);
          return;
        }
        entries.push(...batch);
        readBatch();
      }, reject);
    };

    readBatch();
  });
}

function fileFromEntry(fileEntry) {
  return new Promise((resolve, reject) => {
    fileEntry.file(resolve, reject);
  });
}

function stripQueryAndHash(value) {
  return value.split('#', 1)[0].split('?', 1)[0];
}

function safeDecodeURIComponent(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
