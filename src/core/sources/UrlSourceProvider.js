import { detectFormat, displayNameFromUrl } from '../format/fileTypes.js';

export class UrlSourceProvider {
  async load(url) {
    if (!url) throw new Error('Missing URL.');

    const response = await fetch(url, {
      method: 'GET',
      credentials: 'omit',
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(`Failed to load ${url}: HTTP ${response.status}`);
    }

    const mimeType = response.headers.get('content-type') || '';
    const text = await response.text();

    return {
      id: url,
      name: displayNameFromUrl(url),
      sourceType: 'url',
      baseUrl: url,
      url,
      mimeType,
      format: detectFormat({ url, mimeType }),
      text
    };
  }
}
