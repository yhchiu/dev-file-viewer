import { detectFormat } from '../format/fileTypes.js';

export class FilePickerSourceProvider {
  async pickFile() {
    if ('showOpenFilePicker' in window) {
      const [handle] = await window.showOpenFilePicker({
        multiple: false,
        types: [
          {
            description: 'Markdown documents',
            accept: {
              'text/markdown': ['.md', '.mkd', '.mdx', '.markdown'],
              'text/plain': ['.md', '.mkd', '.mdx', '.markdown']
            }
          }
        ]
      });
      return this.loadFromHandle(handle);
    }

    return this.pickFileWithInputFallback();
  }

  async loadFromHandle(handle) {
    const file = await handle.getFile();
    return this.loadFromFile(file, { handle });
  }

  async loadFromFile(file, extra = {}) {
    const text = await file.text();
    return {
      id: file.name,
      name: file.name,
      sourceType: 'file',
      baseUrl: '',
      mimeType: file.type || '',
      format: detectFormat({ name: file.name, mimeType: file.type || '' }),
      text,
      file,
      ...extra
    };
  }

  pickFileWithInputFallback() {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.md,.mkd,.mdx,.markdown,text/markdown,text/plain';
      input.addEventListener('change', async () => {
        try {
          const file = input.files?.[0];
          if (!file) return reject(new Error('No file selected.'));
          resolve(await this.loadFromFile(file));
        } catch (error) {
          reject(error);
        }
      }, { once: true });
      input.click();
    });
  }
}
