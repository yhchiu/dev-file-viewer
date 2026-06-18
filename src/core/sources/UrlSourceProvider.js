import { FORMAT_IDS, detectFormat, displayNameFromUrl } from '../format/fileTypes.js';
import { looksLikeHtmlSource } from '../format/htmlSourceDetection.js';
import { t } from '../i18n/i18n.js';

export class UrlSourceProvider {
  async load(url) {
    if (!url) throw new Error(t('errorMissingUrl'));

    const response = await fetch(url, {
      method: 'GET',
      credentials: 'omit',
      cache: 'no-store'
    });

    if (!response.ok) {
      throw new Error(t('errorFailedToLoadUrl', [url, String(response.status)]));
    }

    const mimeType = response.headers.get('content-type') || '';
    const text = await response.text();

    const isHtmlSource = looksLikeHtmlSource(text, { mimeType, url });

    return {
      id: url,
      name: displayNameFromUrl(url),
      sourceType: 'url',
      baseUrl: url,
      url,
      mimeType,
      format: isHtmlSource ? FORMAT_IDS.SOURCE_CODE : detectFormat({ url, mimeType }),
      language: isHtmlSource ? 'html' : undefined,
      text
    };
  }
}
