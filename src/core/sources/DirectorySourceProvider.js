import { isSupportedDocumentFile } from '../format/fileTypes.js';
import { FilePickerSourceProvider } from './FilePickerSourceProvider.js';

const MAX_FILES = 2000;

export class DirectorySourceProvider {
  constructor() {
    this.fileProvider = new FilePickerSourceProvider();
  }

  async pickDirectory() {
    if (!('showDirectoryPicker' in window)) {
      throw new Error('This browser does not support folder picker. Use Chrome or Chromium-based browsers.');
    }

    const rootHandle = await window.showDirectoryPicker({ mode: 'read' });
    const tree = await this.buildTree(rootHandle);
    return { rootHandle, tree };
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
      } else if (handle.kind === 'file' && isSupportedDocumentFile(name)) {
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

  async loadFileNode(fileNode) {
    return this.fileProvider.loadFromHandle(fileNode.handle);
  }
}
