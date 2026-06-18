import { ALL_SUPPORTED_EXTENSIONS, detectFormat } from '../format/fileTypes.js';
import { t } from '../i18n/i18n.js';

const SUPPORTED_EXTENSIONS = ALL_SUPPORTED_EXTENSIONS;

export class FilePickerSourceProvider {
  async pickFile(options = {}) {
    if ('showOpenFilePicker' in window) {
      const [handle] = await window.showOpenFilePicker({
        multiple: false,
        types: [
          {
            description: 'Developer files',
            accept: {
              'text/markdown': ['.md', '.mkd', '.mdx', '.markdown'],
              'text/plain': SUPPORTED_EXTENSIONS,
              'application/json': ['.json', '.jsonc'],
              'application/javascript': ['.js', '.mjs', '.cjs'],
              'text/css': ['.css'],
              'text/html': ['.html', '.htm'],
              'application/xml': ['.xml', '.svg']
            }
          }
        ]
      });
      options.onLoadStart?.(handle.name);
      return this.loadFromHandle(handle);
    }

    return this.pickFileWithInputFallback(options);
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

  pickFileWithInputFallback(options = {}) {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = `${SUPPORTED_EXTENSIONS.join(',')},text/markdown,text/plain,application/json,application/javascript,text/css,text/html,application/xml`;
      input.addEventListener(
        'change',
        async () => {
          try {
            const file = input.files?.[0];
            if (!file) return reject(new Error(t('errorNoFileSelected')));
            options.onLoadStart?.(file.name);
            resolve(await this.loadFromFile(file));
          } catch (error) {
            reject(error);
          }
        },
        { once: true }
      );
      input.click();
    });
  }
}
