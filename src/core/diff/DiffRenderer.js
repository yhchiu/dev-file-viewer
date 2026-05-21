function escapeText(value = '') {
  return String(value);
}

export class DiffRenderer {
  render(diffText, targetElement) {
    targetElement.textContent = '';
    targetElement.classList.add('diff-body');

    const wrapper = document.createElement('div');
    wrapper.className = 'diff-viewer';
    const sections = this.parseUnifiedDiff(diffText || '');

    if (!sections.length) {
      const empty = document.createElement('div');
      empty.className = 'diff-empty';
      empty.textContent = 'No diff content found.';
      wrapper.append(empty);
      targetElement.append(wrapper);
      return;
    }

    for (const section of sections) {
      wrapper.append(this.renderFileSection(section));
    }

    targetElement.append(wrapper);
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

    return sections.filter(section => section.meta.length || section.hunks.length || section.oldFile || section.newFile);
  }

  renderFileSection(section) {
    const root = document.createElement('section');
    root.className = 'diff-file';

    const header = document.createElement('div');
    header.className = 'diff-file-header';

    const title = document.createElement('div');
    title.className = 'diff-file-title';
    title.textContent = displayFileTitle(section);

    const stats = diffStats(section);
    const badge = document.createElement('div');
    badge.className = 'diff-file-stats';
    badge.textContent = `+${stats.added} −${stats.removed}`;

    header.append(title, badge);
    root.append(header);

    const metaLines = section.meta.filter(line => line && !line.startsWith('--- ') && !line.startsWith('+++ '));
    if (metaLines.length) {
      const meta = document.createElement('pre');
      meta.className = 'diff-meta';
      meta.textContent = metaLines.join('\n');
      root.append(meta);
    }

    if (!section.hunks.length) {
      const empty = document.createElement('div');
      empty.className = 'diff-empty';
      empty.textContent = 'No hunks in this diff file.';
      root.append(empty);
      return root;
    }

    for (const hunk of section.hunks) {
      root.append(this.renderHunk(hunk));
    }

    return root;
  }

  renderHunk(hunk) {
    const hunkEl = document.createElement('div');
    hunkEl.className = 'diff-hunk';

    const header = document.createElement('div');
    header.className = 'diff-hunk-header';
    header.textContent = hunk.header;
    hunkEl.append(header);

    const table = document.createElement('table');
    table.className = 'diff-table';
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
        codeCell.textContent = escapeText(line.slice(1));
      } else if (type === 'removed') {
        oldCell.textContent = String(oldLine++);
        newCell.textContent = '';
        markerCell.textContent = '−';
        codeCell.textContent = escapeText(line.slice(1));
      } else if (type === 'context') {
        oldCell.textContent = String(oldLine++);
        newCell.textContent = String(newLine++);
        markerCell.textContent = ' ';
        codeCell.textContent = escapeText(line.startsWith(' ') ? line.slice(1) : line);
      } else {
        oldCell.textContent = '';
        newCell.textContent = '';
        markerCell.textContent = '';
        codeCell.textContent = escapeText(line);
      }

      row.append(oldCell, newCell, markerCell, codeCell);
      tbody.append(row);
    }

    hunkEl.append(table);
    return hunkEl;
  }
}

function normalizeFileLabel(value = '') {
  return String(value).trim().replace(/^\w\//, '');
}

function displayFileTitle(section) {
  if (section.newFile && section.newFile !== '/dev/null') return section.newFile;
  if (section.oldFile && section.oldFile !== '/dev/null') return section.oldFile;
  const gitLine = section.meta.find(line => line.startsWith('diff --git '));
  if (gitLine) return gitLine.replace(/^diff --git\s+/, '');
  return 'Diff file';
}

function parseHunkStart(header, sign) {
  const pattern = sign === '-'
    ? /-(\d+)(?:,\d+)?/
    : /\+(\d+)(?:,\d+)?/;
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
