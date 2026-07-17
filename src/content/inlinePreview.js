import { MarkdownEngine } from '../core/markdown/MarkdownEngine.js';
import { SourceCodeRenderer } from '../core/source/SourceCodeRenderer.js';
import { DiffRenderer } from '../core/diff/DiffRenderer.js';
import {
  FORMAT_IDS,
  detectFormat,
  detectLineEnding,
  displayNameFromUrl,
  formatLabel,
  lineEndingLabel,
  sourceLanguageFromPath
} from '../core/format/fileTypes.js';
import { buildHeadingIndex, ensureHeadingAnchors } from '../core/toc/headingIndex.js';
import { inlinePreviewMessage } from '../core/i18n/inlinePreviewI18n.js';
import { PluginRegistry } from '../plugins/PluginRegistry.js';
import { InlineMermaidClient } from './inlineMermaidClient.js';
import { resolveChromeTheme, THEME_KEY } from '../core/ui/chromeTheme.js';
import {
  DEFAULT_VIEWER_FONT_SIZE,
  MAX_VIEWER_FONT_SIZE,
  MIN_VIEWER_FONT_SIZE,
  VIEWER_FONT_SIZE_KEY,
  clampViewerFontSize,
  viewerFontSizeProgress
} from '../core/ui/viewerFontSize.js';

const CONTENT_WIDTH_KEY = 'devFileViewer:contentWidth';
const CONTENT_WIDTHS = Object.freeze({
  narrow: '760px',
  comfortable: '920px',
  wide: '1180px',
  full: '100%'
});

export const INLINE_ROOT_SELECTOR = '[data-dfv-inline-root]';

function applyInlineFontSize(root, elements, value) {
  const fontSize = clampViewerFontSize(value);
  root.style.setProperty('--dfv-inline-font-size', `${fontSize}px`);

  if (elements?.fontSizeRange) {
    elements.fontSizeRange.value = String(fontSize);
    elements.fontSizeRange.style.setProperty(
      '--dfv-inline-font-size-progress',
      `${viewerFontSizeProgress(fontSize)}%`
    );
  }
  if (elements?.fontSizeInput) elements.fontSizeInput.value = String(fontSize);
  return fontSize;
}

function applyAppearanceValues(root, elements, values = {}) {
  const preference = values[THEME_KEY] || 'system';
  const resolved = resolveChromeTheme(
    preference,
    Boolean(globalThis.matchMedia?.('(prefers-color-scheme: dark)')?.matches)
  );
  const width = CONTENT_WIDTHS[values[CONTENT_WIDTH_KEY]] || CONTENT_WIDTHS.comfortable;

  root.dataset.dfvTheme = resolved.colorScheme;
  root.dataset.dfvAppTheme = resolved.appTheme;
  root.style.setProperty('--dfv-inline-content-width', width);
  applyInlineFontSize(root, elements, values[VIEWER_FONT_SIZE_KEY]);
}

async function syncInlineAppearance(root, elements) {
  const keys = [THEME_KEY, CONTENT_WIDTH_KEY, VIEWER_FONT_SIZE_KEY];
  let values = {};

  try {
    values = await chrome.storage.local.get(keys);
  } catch {
    values = {};
  }

  applyAppearanceValues(root, elements, values);

  try {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      let changed = false;
      for (const key of keys) {
        if (!changes[key]) continue;
        values[key] = changes[key].newValue;
        changed = true;
      }
      if (changed) applyAppearanceValues(root, elements, values);
    });
  } catch {
    // A static appearance is enough when storage change events are unavailable.
  }

  globalThis.matchMedia?.('(prefers-color-scheme: dark)')?.addEventListener?.('change', () => {
    if (!values[THEME_KEY] || values[THEME_KEY] === 'system') {
      applyAppearanceValues(root, elements, values);
    }
  });
}

export function findRawSourceElement(doc = document) {
  const body = doc.body;
  if (!body) return null;

  const directPre = [...body.children].find(
    element => element.tagName === 'PRE' && !element.closest(INLINE_ROOT_SELECTOR)
  );
  if (directPre) return directPre;

  if (body.childElementCount === 0 && body.textContent) {
    const pre = doc.createElement('pre');
    pre.textContent = body.textContent;
    body.textContent = '';
    body.append(pre);
    return pre;
  }

  return null;
}

function createButton(doc, className, messageKey) {
  const button = doc.createElement('button');
  button.type = 'button';
  button.className = className;
  button.textContent = inlinePreviewMessage(messageKey);
  return button;
}

function createShell(snapshot, doc = document) {
  const root = doc.createElement('div');
  root.className = 'dfv-inline-root';
  root.dataset.dfvInlineRoot = '';

  const toolbar = doc.createElement('header');
  toolbar.className = 'dfv-inline-toolbar';

  const identity = doc.createElement('div');
  identity.className = 'dfv-inline-identity';

  const title = doc.createElement('div');
  title.className = 'dfv-inline-title';
  title.textContent = snapshot.name;

  const meta = doc.createElement('div');
  meta.className = 'dfv-inline-meta';
  meta.textContent = snapshot.formatLabel;
  identity.append(title, meta);

  const actions = doc.createElement('div');
  actions.className = 'dfv-inline-actions';

  const outlineControl = doc.createElement('div');
  outlineControl.className = 'dfv-inline-outline';

  const outlineToggle = createButton(
    doc,
    'dfv-inline-button dfv-inline-secondary',
    'inlineOutline'
  );
  outlineToggle.dataset.dfvAction = 'toggle-outline';
  outlineToggle.setAttribute('aria-expanded', 'false');
  outlineToggle.setAttribute('aria-haspopup', 'dialog');
  outlineToggle.setAttribute('aria-controls', 'dfv-inline-outline-popover');
  outlineToggle.hidden = true;
  outlineToggle.disabled = true;

  const outlinePopover = doc.createElement('section');
  outlinePopover.id = 'dfv-inline-outline-popover';
  outlinePopover.className = 'dfv-inline-outline-popover';
  outlinePopover.setAttribute('role', 'dialog');
  outlinePopover.setAttribute('aria-label', inlinePreviewMessage('inlineOutlinePopover'));
  outlinePopover.hidden = true;

  const outlineHeader = doc.createElement('div');
  outlineHeader.className = 'dfv-inline-outline-header';

  const outlineTitle = doc.createElement('div');
  outlineTitle.className = 'dfv-inline-outline-title';
  outlineTitle.textContent = inlinePreviewMessage('inlineOutlineOnThisPage');

  const outlineClose = doc.createElement('button');
  outlineClose.type = 'button';
  outlineClose.className = 'dfv-inline-outline-close';
  outlineClose.textContent = '×';
  outlineClose.setAttribute('aria-label', inlinePreviewMessage('inlineCloseOutline'));

  const outlineNav = doc.createElement('nav');
  outlineNav.className = 'dfv-inline-outline-list';
  outlineNav.setAttribute('aria-label', inlinePreviewMessage('inlineOutlinePopover'));

  outlineHeader.append(outlineTitle, outlineClose);
  outlinePopover.append(outlineHeader, outlineNav);
  outlineControl.append(outlineToggle, outlinePopover);
  actions.append(outlineControl);

  const fontSizeControl = doc.createElement('div');
  fontSizeControl.className = 'dfv-inline-text-size';

  const fontSizeToggle = createButton(
    doc,
    'dfv-inline-button dfv-inline-secondary',
    'inlineTextSize'
  );
  fontSizeToggle.dataset.dfvAction = 'toggle-text-size';
  fontSizeToggle.setAttribute('aria-expanded', 'false');
  fontSizeToggle.setAttribute('aria-haspopup', 'true');
  fontSizeToggle.setAttribute('aria-controls', 'dfv-inline-text-size-popover');

  const fontSizePopover = doc.createElement('div');
  fontSizePopover.id = 'dfv-inline-text-size-popover';
  fontSizePopover.className = 'dfv-inline-text-size-popover';
  fontSizePopover.setAttribute('role', 'group');
  fontSizePopover.setAttribute('aria-label', inlinePreviewMessage('inlineTextSizeSetting'));
  fontSizePopover.hidden = true;

  const fontSizeLabel = doc.createElement('label');
  fontSizeLabel.htmlFor = 'dfv-inline-font-size-range';
  fontSizeLabel.textContent = inlinePreviewMessage('inlineTextSize');

  const fontSizeControls = doc.createElement('div');
  fontSizeControls.className = 'dfv-inline-text-size-controls';

  const fontSizeRange = doc.createElement('input');
  fontSizeRange.id = 'dfv-inline-font-size-range';
  fontSizeRange.className = 'dfv-inline-text-size-range';
  fontSizeRange.type = 'range';
  fontSizeRange.min = String(MIN_VIEWER_FONT_SIZE);
  fontSizeRange.max = String(MAX_VIEWER_FONT_SIZE);
  fontSizeRange.step = '1';
  fontSizeRange.value = String(DEFAULT_VIEWER_FONT_SIZE);
  fontSizeRange.setAttribute('aria-label', inlinePreviewMessage('inlineTextSize'));

  const fontSizeInput = doc.createElement('input');
  fontSizeInput.className = 'dfv-inline-text-size-input';
  fontSizeInput.type = 'number';
  fontSizeInput.min = String(MIN_VIEWER_FONT_SIZE);
  fontSizeInput.max = String(MAX_VIEWER_FONT_SIZE);
  fontSizeInput.step = '1';
  fontSizeInput.value = String(DEFAULT_VIEWER_FONT_SIZE);
  fontSizeInput.inputMode = 'numeric';
  fontSizeInput.setAttribute('aria-label', inlinePreviewMessage('inlineTextSizePixels'));

  const fontSizeUnit = doc.createElement('span');
  fontSizeUnit.className = 'dfv-inline-text-size-unit';
  fontSizeUnit.setAttribute('aria-hidden', 'true');
  fontSizeUnit.textContent = 'px';

  fontSizeControls.append(fontSizeRange, fontSizeInput, fontSizeUnit);
  fontSizePopover.append(fontSizeLabel, fontSizeControls);
  fontSizeControl.append(fontSizeToggle, fontSizePopover);
  actions.append(fontSizeControl);

  let toggleSource = null;
  if (snapshot.format === FORMAT_IDS.MARKDOWN) {
    toggleSource = createButton(doc, 'dfv-inline-button dfv-inline-secondary', 'inlineShowSource');
    toggleSource.dataset.dfvAction = 'toggle-source';
    actions.append(toggleSource);
  }

  const fullViewer = createButton(doc, 'dfv-inline-button', 'inlineOpenFullViewer');
  fullViewer.dataset.dfvAction = 'open-full-viewer';
  actions.append(fullViewer);
  toolbar.append(identity, actions);

  const preview = doc.createElement('main');
  preview.className = 'dfv-inline-preview';
  preview.dataset.dfvPreview = '';

  const status = doc.createElement('div');
  status.className = 'dfv-inline-status';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.hidden = true;

  root.append(toolbar, status, preview);
  return {
    root,
    toolbar,
    preview,
    status,
    toggleSource,
    fullViewer,
    meta,
    outlineControl,
    outlineToggle,
    outlinePopover,
    outlineClose,
    outlineNav,
    fontSizeControl,
    fontSizeToggle,
    fontSizePopover,
    fontSizeRange,
    fontSizeInput
  };
}

function sendRuntimeMessage(message) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(message, response => {
      if (chrome.runtime.lastError) {
        reject(chrome.runtime.lastError);
        return;
      }
      if (!response?.ok) {
        reject(new Error(response?.error || 'Dev File Viewer request failed.'));
        return;
      }
      resolve(response);
    });
  });
}

function setStatus(elements, message, type = 'info') {
  elements.status.hidden = !message;
  elements.status.dataset.state = type;
  elements.status.textContent = message || '';
}

function scrollToInitialHash(root) {
  const hash = globalThis.location?.hash;
  if (!hash) return;

  let id = hash.slice(1);
  try {
    id = decodeURIComponent(id);
  } catch {
    // Keep the literal hash fragment when it is not valid percent-encoding.
  }

  const target = [...root.querySelectorAll('[id]')].find(element => element.id === id);
  target?.scrollIntoView?.({ block: 'start' });
}

export class InlinePreview {
  constructor(snapshot, options = {}) {
    this.snapshot = snapshot;
    this.doc = options.document || document;
    this.markdown = options.markdown || new MarkdownEngine(new PluginRegistry());
    this.sourceRenderer = options.sourceRenderer || new SourceCodeRenderer();
    this.diffRenderer = options.diffRenderer || new DiffRenderer();
    this.inlineMermaid = options.inlineMermaid || new InlineMermaidClient();
    this.elements = null;
    this.mode = 'preview';
    this.headings = [];
    this.activeHeadingId = '';
    this.activeHeadingFrame = 0;
    this.renderSequence = 0;
  }

  async mount(sourceElement) {
    if (!sourceElement || this.doc.querySelector(INLINE_ROOT_SELECTOR)) return false;

    this.elements = createShell(this.snapshot, this.doc);
    sourceElement.hidden = true;
    sourceElement.dataset.dfvOriginalSource = '';
    sourceElement.after(this.elements.root);

    await syncInlineAppearance(this.elements.root, this.elements);
    this.bindEvents();
    await this.render();
    scrollToInitialHash(this.elements.preview);
    return true;
  }

  setTextSizePopover(open, { restoreFocus = false } = {}) {
    if (open) this.setOutlinePopover(false);
    this.elements.fontSizePopover.hidden = !open;
    this.elements.fontSizeToggle.setAttribute('aria-expanded', String(open));
    if (open) {
      this.elements.fontSizeRange.focus();
    } else if (restoreFocus) {
      this.elements.fontSizeToggle.focus();
    }
  }

  setOutlinePopover(open, { restoreFocus = false } = {}) {
    const shouldOpen = Boolean(open && this.headings.length);
    if (shouldOpen) this.setTextSizePopover(false);
    this.elements.outlinePopover.hidden = !shouldOpen;
    this.elements.outlineToggle.setAttribute('aria-expanded', String(shouldOpen));

    if (shouldOpen) {
      this.updateActiveHeading();
      const active = this.elements.outlineNav.querySelector('[aria-current="location"]');
      (active || this.elements.outlineNav.querySelector('.dfv-inline-outline-item'))?.focus();
    } else if (restoreFocus) {
      this.elements.outlineToggle.focus();
    }
  }

  setActiveHeading(id) {
    if (!id || id === this.activeHeadingId) return;
    this.activeHeadingId = id;
    for (const item of this.elements.outlineNav.querySelectorAll('.dfv-inline-outline-item')) {
      const active = item.dataset.headingId === id;
      item.classList.toggle('is-active', active);
      if (active) item.setAttribute('aria-current', 'location');
      else item.removeAttribute('aria-current');
    }
  }

  updateActiveHeading() {
    if (!this.headings.length || this.mode !== 'preview') return;

    const toolbarBottom = this.elements.toolbar?.getBoundingClientRect?.().bottom || 0;
    const threshold = toolbarBottom + 18;
    let active = this.headings[0];

    for (const heading of this.headings) {
      if (heading.element.getBoundingClientRect().top > threshold) break;
      active = heading;
    }

    this.setActiveHeading(active?.id || '');
  }

  scheduleActiveHeadingUpdate() {
    if (this.activeHeadingFrame || !this.headings.length) return;
    const requestFrame = globalThis.requestAnimationFrame || (callback => setTimeout(callback, 0));
    this.activeHeadingFrame = requestFrame(() => {
      this.activeHeadingFrame = 0;
      this.updateActiveHeading();
    });
  }

  clearOutline() {
    this.headings = [];
    this.activeHeadingId = '';
    this.elements.outlineNav.replaceChildren();
    this.elements.outlineToggle.hidden = true;
    this.elements.outlineToggle.disabled = true;
    this.setOutlinePopover(false);
  }

  buildOutline() {
    this.headings = buildHeadingIndex(this.elements.preview, { maxLevel: 6 });
    this.activeHeadingId = '';
    this.elements.outlineNav.replaceChildren();

    if (!this.headings.length) {
      this.clearOutline();
      return;
    }

    for (const heading of this.headings) {
      const item = this.doc.createElement('a');
      item.className = 'dfv-inline-outline-item';
      item.href = `#${encodeURIComponent(heading.id)}`;
      item.textContent = heading.text;
      item.title = heading.text;
      item.dataset.headingId = heading.id;
      item.style.setProperty(
        '--dfv-inline-outline-indent',
        `${Math.max(0, heading.level - 1) * 14}px`
      );
      item.addEventListener('click', event => {
        if (
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        ) {
          return;
        }
        event.preventDefault();
        heading.element.scrollIntoView?.({ block: 'start' });
        this.setActiveHeading(heading.id);
        this.setOutlinePopover(false);
      });
      this.elements.outlineNav.append(item);
    }

    this.elements.outlineToggle.hidden = false;
    this.elements.outlineToggle.disabled = false;
    this.scheduleActiveHeadingUpdate();
  }

  async persistViewerFontSize(value) {
    const fontSize = applyInlineFontSize(this.elements.root, this.elements, value);
    try {
      await chrome.storage.local.set({ [VIEWER_FONT_SIZE_KEY]: fontSize });
    } catch {
      // Keep the current-page preview usable when storage is unavailable.
    }
  }

  bindEvents() {
    this.elements.outlineToggle.addEventListener('click', () => {
      this.setOutlinePopover(this.elements.outlinePopover.hidden);
    });
    this.elements.outlineClose.addEventListener('click', () => {
      this.setOutlinePopover(false, { restoreFocus: true });
    });

    this.elements.fontSizeToggle.addEventListener('click', () => {
      this.setTextSizePopover(this.elements.fontSizePopover.hidden);
    });

    this.elements.fontSizeRange.addEventListener('input', () => {
      applyInlineFontSize(this.elements.root, this.elements, this.elements.fontSizeRange.value);
    });
    this.elements.fontSizeRange.addEventListener('change', () => {
      this.persistViewerFontSize(this.elements.fontSizeRange.value);
    });
    this.elements.fontSizeInput.addEventListener('change', () => {
      this.persistViewerFontSize(this.elements.fontSizeInput.value);
    });

    this.doc.addEventListener('click', event => {
      if (
        !this.elements.outlinePopover.hidden &&
        !this.elements.outlineControl.contains(event.target)
      ) {
        this.setOutlinePopover(false);
      }
      if (
        !this.elements.fontSizePopover.hidden &&
        !this.elements.fontSizeControl.contains(event.target)
      ) {
        this.setTextSizePopover(false);
      }
    });
    this.doc.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      if (!this.elements.outlinePopover.hidden) {
        event.preventDefault();
        this.setOutlinePopover(false, { restoreFocus: true });
        return;
      }
      if (this.elements.fontSizePopover.hidden) return;
      event.preventDefault();
      this.setTextSizePopover(false, { restoreFocus: true });
    });
    globalThis.addEventListener?.('scroll', () => this.scheduleActiveHeadingUpdate(), {
      passive: true
    });

    this.elements.toggleSource?.addEventListener('click', () => {
      this.mode = this.mode === 'source' ? 'preview' : 'source';
      this.render().catch(error =>
        setStatus(this.elements, error?.message || String(error), 'error')
      );
    });

    this.elements.fullViewer.addEventListener('click', async () => {
      this.elements.fullViewer.disabled = true;
      setStatus(this.elements, inlinePreviewMessage('inlineOpeningFullViewer'));
      try {
        await sendRuntimeMessage({
          type: 'OPEN_VIEWER_FOR_SNAPSHOT',
          disposition: 'new-tab',
          url: this.snapshot.url,
          title: this.snapshot.title,
          mimeType: this.snapshot.mimeType,
          format: this.snapshot.format,
          language: this.snapshot.language,
          text: this.snapshot.text
        });
        setStatus(this.elements, '');
      } catch (error) {
        setStatus(
          this.elements,
          inlinePreviewMessage('inlineOpenFullViewerFailed', [error?.message || String(error)]),
          'error'
        );
      } finally {
        this.elements.fullViewer.disabled = false;
      }
    });
  }

  resetPreviewClasses() {
    this.elements.preview.className = 'dfv-inline-preview';
    this.elements.preview.removeAttribute('data-diff-view-mode');
  }

  async render() {
    const renderSequence = ++this.renderSequence;
    this.resetPreviewClasses();
    setStatus(this.elements, '');
    this.clearOutline();

    const { format, text } = this.snapshot;
    const markdownSource = format === FORMAT_IDS.MARKDOWN && this.mode === 'source';

    if (
      format === FORMAT_IDS.SOURCE_CODE ||
      format === FORMAT_IDS.TEXT ||
      format === FORMAT_IDS.UNKNOWN ||
      markdownSource
    ) {
      this.elements.preview.classList.add('source-code-body');
      const language = markdownSource
        ? 'markdown'
        : format === FORMAT_IDS.TEXT || format === FORMAT_IDS.UNKNOWN
          ? 'plaintext'
          : this.snapshot.language;
      this.sourceRenderer.render(text, this.elements.preview, {
        language,
        name: this.snapshot.name,
        url: this.snapshot.url
      });
      if (this.elements.toggleSource) {
        this.elements.toggleSource.textContent = inlinePreviewMessage('inlineShowPreview');
      }
      return;
    }

    if (format === FORMAT_IDS.DIFF) {
      this.elements.preview.classList.add('diff-body');
      this.diffRenderer.render(text, this.elements.preview, {
        name: this.snapshot.name,
        url: this.snapshot.url
      });
      return;
    }

    await this.markdown.render(text, this.elements.preview, {
      baseUrl: this.snapshot.url,
      linkOptions: { supportedDocumentBehavior: 'navigate' }
    });
    if (renderSequence !== this.renderSequence) return;

    ensureHeadingAnchors(this.elements.preview);
    try {
      await this.inlineMermaid.render(this.elements.preview);
    } catch (error) {
      console.warn('Dev File Viewer could not render Mermaid diagrams:', error);
    }
    if (renderSequence !== this.renderSequence) return;

    this.buildOutline();
    if (this.elements.toggleSource) {
      this.elements.toggleSource.textContent = inlinePreviewMessage('inlineShowSource');
    }
  }
}

export function buildInlineSnapshot({ url, title = '', mimeType = '', text = '' }) {
  const name = displayNameFromUrl(url);
  const format = detectFormat({ url, name, mimeType });
  const language = format === FORMAT_IDS.SOURCE_CODE ? sourceLanguageFromPath(name || url) : '';
  let label = formatLabel(format);

  if (format === FORMAT_IDS.TEXT) {
    label = `${label} · ${lineEndingLabel(detectLineEnding(text))}`;
  } else if (language === 'html') {
    label = 'HTML';
  }

  return {
    url,
    title,
    mimeType,
    text,
    name,
    format,
    language,
    formatLabel: label
  };
}

export async function renderInlinePreview(input, options = {}) {
  const doc = options.document || document;
  if (doc.querySelector(INLINE_ROOT_SELECTOR)) return true;

  const sourceElement = options.sourceElement || findRawSourceElement(doc);
  if (!sourceElement) return false;

  const preview = new InlinePreview(buildInlineSnapshot(input), options);
  return preview.mount(sourceElement);
}
