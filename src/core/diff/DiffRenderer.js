import { t } from '../i18n/i18n.js';

export class DiffRenderer {
  constructor(options = {}) {
    this.viewMode = normalizeDiffViewMode(options.viewMode);
  }

  render(diffText, targetElement, options = {}) {
    this.viewMode = normalizeDiffViewMode(options.viewMode || this.viewMode);
    targetElement.textContent = '';
    targetElement.classList.add('diff-body');
    targetElement.dataset.diffViewMode = this.viewMode;

    const wrapper = document.createElement('div');
    wrapper.className = 'diff-viewer';
    wrapper.dataset.diffViewMode = this.viewMode;
    const sections = this.parseUnifiedDiff(diffText || '');
    const outlineFiles = [];
    const hunkRecords = [];

    const toolbar = this.renderViewToolbar();
    wrapper.append(toolbar);

    const applyViewMode = viewMode => {
      this.viewMode = normalizeDiffViewMode(viewMode);
      targetElement.dataset.diffViewMode = this.viewMode;
      wrapper.dataset.diffViewMode = this.viewMode;
      updateViewToolbar(toolbar, this.viewMode);

      for (const { element, hunk } of hunkRecords) {
        this.renderHunkBody(element, hunk, this.viewMode);
      }
    };

    toolbar.addEventListener('click', event => {
      const button = event.target.closest?.('[data-diff-view-mode]');
      if (!button || !toolbar.contains(button)) return;
      applyViewMode(button.dataset.diffViewMode);
    });

    if (!sections.length) {
      const empty = document.createElement('div');
      empty.className = 'diff-empty';
      empty.textContent = t('diffNoContent');
      wrapper.append(empty);
      targetElement.append(wrapper);
      return { files: [] };
    }

    sections.forEach((section, index) => {
      const rendered = this.renderFileSection(section, index);
      wrapper.append(rendered.element);
      outlineFiles.push(rendered.outline);
      hunkRecords.push(...rendered.hunks);
    });

    targetElement.append(wrapper);
    return { files: outlineFiles };
  }

  renderViewToolbar() {
    const toolbar = document.createElement('div');
    toolbar.className = 'diff-view-toolbar';

    const toggle = document.createElement('div');
    toggle.className = 'diff-view-toggle';
    toggle.setAttribute('role', 'group');
    toggle.setAttribute('aria-label', t('diffViewMode'));

    for (const mode of ['unified', 'split']) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'diff-view-toggle-button';
      button.dataset.diffViewMode = mode;
      button.textContent = t(mode === 'split' ? 'diffViewSplit' : 'diffViewUnified');
      toggle.append(button);
    }

    toolbar.append(toggle);
    updateViewToolbar(toolbar, this.viewMode);
    return toolbar;
  }

  parseUnifiedDiff(text) {
    const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
    const sections = [];
    let current = null;

    const ensureSection = () => {
      if (!current) {
        current = {
          oldFile: '',
          newFile: '',
          meta: [],
          hunks: []
        };
        sections.push(current);
      }
      return current;
    };

    for (const line of lines) {
      if (line.startsWith('diff --git ')) {
        current = {
          oldFile: '',
          newFile: '',
          meta: [line],
          hunks: []
        };
        sections.push(current);
        continue;
      }

      const section = ensureSection();

      if (line.startsWith('--- ')) {
        section.oldFile = normalizeFileLabel(line.slice(4));
        section.meta.push(line);
        continue;
      }

      if (line.startsWith('+++ ')) {
        section.newFile = normalizeFileLabel(line.slice(4));
        section.meta.push(line);
        continue;
      }

      if (line.startsWith('rename from ')) {
        section.oldFile = normalizeFileLabel(line.slice('rename from '.length));
        section.meta.push(line);
        continue;
      }

      if (line.startsWith('rename to ')) {
        section.newFile = normalizeFileLabel(line.slice('rename to '.length));
        section.meta.push(line);
        continue;
      }

      if (line.startsWith('@@')) {
        section.hunks.push({
          header: line,
          oldLine: parseHunkStart(line, '-'),
          newLine: parseHunkStart(line, '+'),
          lines: []
        });
        continue;
      }

      const hunk = section.hunks.at(-1);
      if (hunk) {
        hunk.lines.push(line);
      } else {
        section.meta.push(line);
      }
    }

    return sections.filter(
      section => section.meta.length || section.hunks.length || section.oldFile || section.newFile
    );
  }

  renderFileSection(section, index) {
    const filePath = displayFileTitle(section);
    const stats = diffStats(section);
    const id = uniqueFileSectionId(filePath, index);

    const root = document.createElement('section');
    root.className = 'diff-file';
    root.id = id;
    root.dataset.diffFilePath = filePath;
    root.dataset.diffAdded = String(stats.added);
    root.dataset.diffRemoved = String(stats.removed);

    const header = document.createElement('div');
    header.className = 'diff-file-header';

    const title = document.createElement('div');
    title.className = 'diff-file-title';
    title.textContent = filePath;

    const badge = document.createElement('div');
    badge.className = 'diff-file-stats';
    badge.textContent = `+${stats.added} −${stats.removed}`;

    header.append(title, badge);
    root.append(header);

    const metaLines = section.meta.filter(
      line => line && !line.startsWith('--- ') && !line.startsWith('+++ ')
    );
    if (metaLines.length) {
      const meta = document.createElement('pre');
      meta.className = 'diff-meta';
      meta.textContent = metaLines.join('\n');
      root.append(meta);
    }

    if (!section.hunks.length) {
      const empty = document.createElement('div');
      empty.className = 'diff-empty';
      empty.textContent = t('diffNoHunks');
      root.append(empty);
      return {
        element: root,
        hunks: [],
        outline: { id, path: filePath, text: filePath, stats, element: root }
      };
    }

    const hunkRecords = [];
    for (const hunk of section.hunks) {
      const hunkElement = this.renderHunk(hunk, this.viewMode);
      root.append(hunkElement);
      hunkRecords.push({ element: hunkElement, hunk });
    }

    return {
      element: root,
      hunks: hunkRecords,
      outline: { id, path: filePath, text: filePath, stats, element: root }
    };
  }

  renderHunk(hunk, viewMode = this.viewMode) {
    const hunkEl = document.createElement('div');
    hunkEl.className = 'diff-hunk';

    const header = document.createElement('div');
    header.className = 'diff-hunk-header';
    header.textContent = hunk.header;
    hunkEl.append(header);

    this.renderHunkBody(hunkEl, hunk, viewMode);
    return hunkEl;
  }

  renderHunkBody(hunkEl, hunk, viewMode = this.viewMode) {
    hunkEl.querySelector('.diff-table')?.remove();
    const table =
      normalizeDiffViewMode(viewMode) === 'split'
        ? this.renderSplitHunkTable(hunk)
        : this.renderUnifiedHunkTable(hunk);
    hunkEl.append(table);
  }

  renderUnifiedHunkTable(hunk) {
    const table = document.createElement('table');
    table.className = 'diff-table diff-table-unified';
    const tbody = document.createElement('tbody');
    table.append(tbody);

    let oldLine = hunk.oldLine;
    let newLine = hunk.newLine;

    for (const line of hunk.lines) {
      const type = classifyDiffLine(line);
      const row = document.createElement('tr');
      row.className = `diff-line diff-line-${type}`;

      const oldCell = document.createElement('td');
      oldCell.className = 'diff-line-number diff-line-number-old';
      const newCell = document.createElement('td');
      newCell.className = 'diff-line-number diff-line-number-new';
      const markerCell = document.createElement('td');
      markerCell.className = 'diff-marker';
      const codeCell = document.createElement('td');
      codeCell.className = 'diff-code';

      if (type === 'added') {
        oldCell.textContent = '';
        newCell.textContent = String(newLine++);
        markerCell.textContent = '+';
        codeCell.textContent = line.slice(1);
      } else if (type === 'removed') {
        oldCell.textContent = String(oldLine++);
        newCell.textContent = '';
        markerCell.textContent = '−';
        codeCell.textContent = line.slice(1);
      } else if (type === 'context') {
        oldCell.textContent = String(oldLine++);
        newCell.textContent = String(newLine++);
        markerCell.textContent = ' ';
        codeCell.textContent = line.startsWith(' ') ? line.slice(1) : line;
      } else {
        oldCell.textContent = '';
        newCell.textContent = '';
        markerCell.textContent = '';
        codeCell.textContent = line;
      }

      row.append(oldCell, newCell, markerCell, codeCell);
      tbody.append(row);
    }

    return table;
  }

  renderSplitHunkTable(hunk) {
    const table = document.createElement('table');
    table.className = 'diff-table diff-table-split';
    const tbody = document.createElement('tbody');
    table.append(tbody);

    let oldLine = hunk.oldLine;
    let newLine = hunk.newLine;

    for (let index = 0; index < hunk.lines.length; ) {
      const line = hunk.lines[index];
      const type = classifyDiffLine(line);

      if (type === 'context') {
        const code = line.startsWith(' ') ? line.slice(1) : line;
        tbody.append(
          createSplitRow({
            rowClass: 'diff-line diff-line-context diff-split-line-context',
            oldLine: String(oldLine++),
            oldMarker: ' ',
            oldCode: code,
            newLine: String(newLine++),
            newMarker: ' ',
            newCode: code
          })
        );
        index += 1;
        continue;
      }

      if (type === 'note') {
        tbody.append(
          createSplitRow({
            rowClass: 'diff-line diff-line-note diff-split-line-note',
            oldCode: line
          })
        );
        index += 1;
        continue;
      }

      if (type === 'added' || type === 'removed') {
        const removed = [];
        const added = [];

        while (index < hunk.lines.length) {
          const changeLine = hunk.lines[index];
          const changeType = classifyDiffLine(changeLine);
          if (changeType !== 'added' && changeType !== 'removed') break;

          if (changeType === 'removed') {
            removed.push({ line: String(oldLine++), code: changeLine.slice(1) });
          } else {
            added.push({ line: String(newLine++), code: changeLine.slice(1) });
          }
          index += 1;
        }

        const rowCount = Math.max(removed.length, added.length);
        for (let offset = 0; offset < rowCount; offset += 1) {
          const oldChange = removed[offset];
          const newChange = added[offset];
          tbody.append(
            createSplitRow({
              rowClass: 'diff-line diff-split-line-change',
              oldLine: oldChange?.line || '',
              oldMarker: oldChange ? '−' : '',
              oldCode: oldChange?.code || '',
              oldClasses: oldChange ? ['diff-split-removed'] : ['diff-split-empty'],
              newLine: newChange?.line || '',
              newMarker: newChange ? '+' : '',
              newCode: newChange?.code || '',
              newClasses: newChange ? ['diff-split-added'] : ['diff-split-empty']
            })
          );
        }
        continue;
      }

      tbody.append(
        createSplitRow({
          rowClass: 'diff-line diff-line-context diff-split-line-context',
          oldCode: line,
          newCode: line
        })
      );
      index += 1;
    }

    return table;
  }
}

function updateViewToolbar(toolbar, viewMode) {
  const normalizedMode = normalizeDiffViewMode(viewMode);
  for (const button of toolbar.querySelectorAll('[data-diff-view-mode]')) {
    const active = button.dataset.diffViewMode === normalizedMode;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  }
}

function normalizeDiffViewMode(value) {
  return value === 'split' ? 'split' : 'unified';
}

function createSplitRow({
  rowClass,
  oldLine = '',
  oldMarker = '',
  oldCode = '',
  oldClasses = [],
  newLine = '',
  newMarker = '',
  newCode = '',
  newClasses = []
}) {
  const row = document.createElement('tr');
  row.className = rowClass;

  const oldNumberCell = createSplitCell(
    'diff-line-number diff-line-number-old diff-split-old',
    oldLine,
    oldClasses
  );
  const oldMarkerCell = createSplitCell(
    'diff-marker diff-marker-old diff-split-old',
    oldMarker,
    oldClasses
  );
  const oldCodeCell = createSplitCell(
    'diff-code diff-code-old diff-split-old',
    oldCode,
    oldClasses
  );
  const newNumberCell = createSplitCell(
    'diff-line-number diff-line-number-new diff-split-new',
    newLine,
    newClasses
  );
  const newMarkerCell = createSplitCell(
    'diff-marker diff-marker-new diff-split-new',
    newMarker,
    newClasses
  );
  const newCodeCell = createSplitCell(
    'diff-code diff-code-new diff-split-new',
    newCode,
    newClasses
  );

  row.append(oldNumberCell, oldMarkerCell, oldCodeCell, newNumberCell, newMarkerCell, newCodeCell);
  return row;
}

function createSplitCell(className, text, extraClasses = []) {
  const cell = document.createElement('td');
  cell.className = className;
  for (const extraClass of extraClasses) cell.classList.add(extraClass);
  cell.textContent = text;
  return cell;
}

function normalizeFileLabel(value = '') {
  return String(value)
    .trim()
    .replace(/^[ab]\//, '');
}

function displayFileTitle(section) {
  if (section.newFile && section.newFile !== '/dev/null') return section.newFile;
  if (section.oldFile && section.oldFile !== '/dev/null') return section.oldFile;
  const gitLine = section.meta.find(line => line.startsWith('diff --git '));
  if (gitLine) {
    const parts = gitLine.trim().split(/\s+/);
    return normalizeFileLabel(parts.at(-1) || gitLine.replace(/^diff --git\s+/, ''));
  }
  return t('diffFileFallback');
}

function parseHunkStart(header, sign) {
  const pattern = sign === '-' ? /-(\d+)(?:,\d+)?/ : /\+(\d+)(?:,\d+)?/;
  const match = header.match(pattern);
  return match ? Number(match[1]) : 0;
}

function classifyDiffLine(line) {
  if (line.startsWith('+') && !line.startsWith('+++')) return 'added';
  if (line.startsWith('-') && !line.startsWith('---')) return 'removed';
  if (line.startsWith(' ')) return 'context';
  if (line.startsWith('\\ No newline at end of file')) return 'note';
  return 'context';
}

function diffStats(section) {
  let added = 0;
  let removed = 0;
  for (const hunk of section.hunks) {
    for (const line of hunk.lines) {
      if (line.startsWith('+') && !line.startsWith('+++')) added += 1;
      if (line.startsWith('-') && !line.startsWith('---')) removed += 1;
    }
  }
  return { added, removed };
}

function uniqueFileSectionId(filePath, index) {
  const slug =
    String(filePath || 'diff-file')
      .toLowerCase()
      .replace(/^[ab]\//, '')
      .replace(/[^a-z0-9._/-]+/g, '-')
      .replace(/[/.]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'diff-file';

  return `diff-file-${index + 1}-${slug}`;
}
