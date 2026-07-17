const INLINE_PREVIEW_MESSAGES = Object.freeze({
  en: Object.freeze({
    inlinePreviewHeading: 'Preview mode',
    inlinePreviewLabel: 'Use Inline Preview',
    inlinePreviewHint:
      'Renders the file in its original page so translation, gesture, dictionary, and accessibility extensions can work with the preview. Turn this on to use Inline Preview instead of opening the full viewer automatically.',
    inlineOpenFullViewer: 'Open in Full Viewer',
    inlineOutline: 'Outline',
    inlineOutlinePopover: 'Document outline',
    inlineOutlineOnThisPage: 'On this page',
    inlineCloseOutline: 'Close outline',
    inlineTextSize: 'Text size',
    inlineTextSizeSetting: 'Inline Preview text size setting',
    inlineTextSizePixels: 'Text size in pixels',
    inlineShowSource: 'Show source',
    inlineShowPreview: 'Show preview',
    inlineOpeningFullViewer: 'Opening the full viewer...',
    inlineOpenFullViewerFailed: 'Could not open the full viewer: $1'
  }),
  zh_CN: Object.freeze({
    inlinePreviewHeading: '预览模式',
    inlinePreviewLabel: '使用 Inline Preview',
    inlinePreviewHint:
      '直接在原始页面渲染文件，让翻译、手势、词典与无障碍扩展能够操作预览内容。开启后，自动打开时会使用 Inline Preview，而不是完整 Viewer。',
    inlineOpenFullViewer: '在完整 Viewer 中打开',
    inlineOutline: '大纲',
    inlineOutlinePopover: '文档大纲',
    inlineOutlineOnThisPage: '本页内容',
    inlineCloseOutline: '关闭大纲',
    inlineTextSize: '文字大小',
    inlineTextSizeSetting: 'Inline Preview 文字大小设置',
    inlineTextSizePixels: '文字大小（像素）',
    inlineShowSource: '显示源代码',
    inlineShowPreview: '显示预览',
    inlineOpeningFullViewer: '正在打开完整 Viewer…',
    inlineOpenFullViewerFailed: '无法打开完整 Viewer：$1'
  }),
  zh_TW: Object.freeze({
    inlinePreviewHeading: '預覽模式',
    inlinePreviewLabel: '使用 Inline Preview',
    inlinePreviewHint:
      '直接在原始頁面渲染檔案，讓翻譯、手勢、字典與無障礙 Extension 能操作預覽內容。開啟後，自動開啟時會使用 Inline Preview，而不是完整 Viewer。',
    inlineOpenFullViewer: '在完整 Viewer 開啟',
    inlineOutline: '大綱',
    inlineOutlinePopover: '文件大綱',
    inlineOutlineOnThisPage: '本頁內容',
    inlineCloseOutline: '關閉大綱',
    inlineTextSize: '文字大小',
    inlineTextSizeSetting: 'Inline Preview 文字大小設定',
    inlineTextSizePixels: '文字大小（像素）',
    inlineShowSource: '顯示原始碼',
    inlineShowPreview: '顯示預覽',
    inlineOpeningFullViewer: '正在開啟完整 Viewer…',
    inlineOpenFullViewerFailed: '無法開啟完整 Viewer：$1'
  })
});

function currentLocale() {
  try {
    const locale = chrome.i18n.getMessage('@@ui_locale');
    if (/^zh[-_]TW$/i.test(locale)) return 'zh_TW';
    if (/^zh[-_]CN$/i.test(locale)) return 'zh_CN';
  } catch {
    // Fall back to English when chrome.i18n is unavailable.
  }
  return 'en';
}

export function inlinePreviewMessage(key, substitutions) {
  const catalog = INLINE_PREVIEW_MESSAGES[currentLocale()] || INLINE_PREVIEW_MESSAGES.en;
  let message = catalog[key] || INLINE_PREVIEW_MESSAGES.en[key] || key;
  const values =
    substitutions == null ? [] : Array.isArray(substitutions) ? substitutions : [substitutions];
  message = message.replace(/\$(\d+)/g, (whole, index) => {
    const value = values[Number(index) - 1];
    return value == null ? '' : String(value);
  });
  return message;
}

export function localizeInlinePreviewDocument(root = document) {
  for (const element of root.querySelectorAll('[data-inline-preview-i18n]')) {
    element.textContent = inlinePreviewMessage(element.getAttribute('data-inline-preview-i18n'));
  }
}
