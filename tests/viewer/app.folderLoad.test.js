import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DevFileViewerApp } from '../../src/viewer/app.js';
import { FileTabsController } from '../../src/viewer/controllers/FileTabsController.js';

function mountFolderLoadApp() {
  document.body.innerHTML = `
    <div id="doc-title"></div>
    <div id="doc-source"></div>
    <div id="doc-format"></div>
    <div id="preview"></div>
    <div id="scroll-nav"></div>
    <button id="btn-reload-document"></button>
    <button id="btn-toggle-source" hidden>
      <svg><use href="../assets/icons/sprite.svg#code"></use></svg>
    </button>
    <div id="viewer-loading" hidden></div>
    <div id="viewer-scroll"></div>
    <div id="file-tabs" hidden>
      <div id="file-tabs-list"></div>
    </div>
  `;

  const app = Object.create(DevFileViewerApp.prototype);
  app.elements = {
    title: document.querySelector('#doc-title'),
    source: document.querySelector('#doc-source'),
    format: document.querySelector('#doc-format'),
    preview: document.querySelector('#preview'),
    scrollNav: document.querySelector('#scroll-nav'),
    reloadDocument: document.querySelector('#btn-reload-document'),
    toggleSource: document.querySelector('#btn-toggle-source'),
    viewerLoading: document.querySelector('#viewer-loading'),
    viewerScroll: document.querySelector('#viewer-scroll'),
    fileTabs: document.querySelector('#file-tabs'),
    fileTabsList: document.querySelector('#file-tabs-list')
  };
  app.outline = { clearToc: vi.fn() };
  app.fileTabs = new FileTabsController(app);
  app.currentDoc = null;
  app.currentDocKey = '';
  return app;
}

describe('clearViewerForFolder', () => {
  beforeEach(() => {
    document.title = 'Dev File Viewer';
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('keeps open tabs and the current preview when a document is already shown', () => {
    const app = mountFolderLoadApp();
    const doc = { name: 'notes.md', text: '# Hello' };
    app.currentDoc = doc;
    app.currentDocKey = 'file:notes.md';
    app.fileTabs.upsertFileTab(doc, 'file:notes.md');
    app.elements.title.textContent = 'notes.md';
    app.elements.source.textContent = 'notes.md';
    app.elements.format.textContent = 'Markdown';
    app.elements.preview.textContent = '# Hello';
    app.elements.preview.classList.add('is-loading');
    app.elements.scrollNav.hidden = false;
    app.elements.reloadDocument.hidden = false;
    app.elements.reloadDocument.disabled = false;
    app.elements.viewerScroll.scrollTop = 42;
    const clearTabs = vi.spyOn(app.fileTabs, 'clearAllFileTabs');

    app.clearViewerForFolder('Folder loaded. Select a file from the sidebar.');

    expect(clearTabs).not.toHaveBeenCalled();
    expect(app.fileTabs.openTabs).toHaveLength(1);
    expect(app.fileTabs.openTabs[0].key).toBe('file:notes.md');
    expect(app.currentDoc).toBe(doc);
    expect(app.currentDocKey).toBe('file:notes.md');
    expect(app.elements.title.textContent).toBe('notes.md');
    expect(app.elements.source.textContent).toBe('notes.md');
    expect(app.elements.format.textContent).toBe('Markdown');
    expect(app.elements.preview.textContent).toBe('# Hello');
    expect(app.elements.preview.classList.contains('is-loading')).toBe(false);
    expect(app.elements.scrollNav.hidden).toBe(false);
    expect(app.elements.reloadDocument.hidden).toBe(false);
    expect(app.elements.reloadDocument.disabled).toBe(false);
    expect(app.elements.viewerScroll.scrollTop).toBe(42);
    expect(app.outline.clearToc).not.toHaveBeenCalled();
  });

  it('keeps tabs when the viewer chrome is empty after a failed load', () => {
    const app = mountFolderLoadApp();
    app.fileTabs.upsertFileTab({ name: 'broken.md' }, 'file:broken.md');
    app.currentDoc = null;
    app.currentDocKey = '';
    app.elements.title.textContent = 'broken.md';
    app.elements.source.textContent = 'broken.md';
    app.elements.format.textContent = 'Unknown';
    const clearTabs = vi.spyOn(app.fileTabs, 'clearAllFileTabs');

    app.clearViewerForFolder('Folder loaded. Select a file from the sidebar.');

    expect(clearTabs).not.toHaveBeenCalled();
    expect(app.fileTabs.openTabs).toHaveLength(1);
    expect(app.elements.title.textContent).toBe('broken.md');
    expect(app.elements.source.textContent).toBe('broken.md');
    expect(app.elements.format.textContent).toBe('Unknown');
    expect(app.outline.clearToc).not.toHaveBeenCalled();
  });

  it('shows the empty folder placeholder when nothing is open', () => {
    const app = mountFolderLoadApp();
    app.elements.preview.classList.add('source-code-body');
    app.elements.scrollNav.hidden = false;
    app.elements.reloadDocument.hidden = false;
    app.elements.reloadDocument.disabled = false;
    app.elements.viewerScroll.scrollTop = 18;
    const clearTabs = vi.spyOn(app.fileTabs, 'clearAllFileTabs');

    app.clearViewerForFolder('Folder loaded. Select a file from the sidebar.');

    expect(clearTabs).not.toHaveBeenCalled();
    expect(app.fileTabs.openTabs).toHaveLength(0);
    expect(app.elements.title.textContent).toBe('No file selected');
    expect(document.title).toBe('Dev File Viewer');
    expect(app.elements.source.textContent).toBe('Folder loaded. Select a file from the sidebar.');
    expect(app.elements.format.textContent).toBe('Folder');
    expect(app.elements.preview.textContent).toBe('');
    expect(app.elements.preview.classList.contains('source-code-body')).toBe(false);
    expect(app.elements.scrollNav.hidden).toBe(true);
    expect(app.elements.reloadDocument.hidden).toBe(true);
    expect(app.elements.reloadDocument.disabled).toBe(true);
    expect(app.elements.viewerScroll.scrollTop).toBe(0);
    expect(app.outline.clearToc).toHaveBeenCalledTimes(1);
  });
});
