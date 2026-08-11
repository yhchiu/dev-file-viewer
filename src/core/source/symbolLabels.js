// Localized display labels for the symbol kinds produced by sourceSymbols.js.
// Lives in core/ so both the viewer outline panel and the Inline Preview
// outline (a content script) can share it.
import { t } from '../i18n/i18n.js';

export function symbolKindLabel(kind) {
  switch (kind) {
    case 'class':
      return t('symbolClass');
    case 'interface':
      return t('symbolInterface');
    case 'method':
      return t('symbolMethod');
    case 'function':
      return t('symbolFunction');
    case 'type':
      return t('symbolType');
    case 'enum':
      return t('symbolEnum');
    case 'module':
      return t('symbolModule');
    default:
      return t('symbolGeneric');
  }
}
