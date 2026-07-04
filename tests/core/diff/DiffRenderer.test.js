import { describe, it, expect, beforeEach } from 'vitest';
import { DiffRenderer } from '../../../src/core/diff/DiffRenderer.js';

let target;
beforeEach(() => {
  target = document.createElement('div');
});

const SAMPLE = [
  'diff --git a/foo.js b/foo.js',
  '--- a/foo.js',
  '+++ b/foo.js',
  '@@ -1,2 +1,3 @@',
  ' context',
  '-removed',
  '+added1',
  '+added2'
].join('\n');

describe('DiffRenderer.render', () => {
  it('renders a file section with hunk rows and stats', () => {
    const outline = new DiffRenderer().render(SAMPLE, target);
    expect(outline.files).toHaveLength(1);

    const file = target.querySelector('.diff-file');
    expect(file.querySelector('.diff-file-title').textContent).toBe('foo.js');
    expect(file.querySelector('.diff-file-stats').textContent).toContain('+2');
    expect(file.querySelector('.diff-file-stats').textContent).toContain('1');

    expect(target.querySelectorAll('.diff-line-added')).toHaveLength(2);
    expect(target.querySelectorAll('.diff-line-removed')).toHaveLength(1);
    expect(target.querySelectorAll('.diff-line-context')).toHaveLength(1);
  });

  it('renders unified view by default with a split-view toggle', () => {
    new DiffRenderer().render(SAMPLE, target);

    expect(target.dataset.diffViewMode).toBe('unified');
    expect(target.querySelector('.diff-viewer').dataset.diffViewMode).toBe('unified');
    expect(target.querySelector('.diff-table-unified')).not.toBeNull();
    expect(target.querySelector('.diff-table-split')).toBeNull();

    const unifiedButton = target.querySelector(
      '.diff-view-toggle-button[data-diff-view-mode="unified"]'
    );
    const splitButton = target.querySelector(
      '.diff-view-toggle-button[data-diff-view-mode="split"]'
    );
    expect(unifiedButton.textContent).toBe('Unified');
    expect(splitButton.textContent).toBe('Split');
    expect(unifiedButton.getAttribute('aria-pressed')).toBe('true');
    expect(splitButton.getAttribute('aria-pressed')).toBe('false');
  });

  it('switches to side-by-side split view and pairs removed and added lines', () => {
    const renderer = new DiffRenderer();
    renderer.render(SAMPLE, target);

    target.querySelector('.diff-view-toggle-button[data-diff-view-mode="split"]').click();

    expect(renderer.viewMode).toBe('split');
    expect(target.dataset.diffViewMode).toBe('split');
    expect(target.querySelector('.diff-viewer').dataset.diffViewMode).toBe('split');
    expect(target.querySelector('.diff-table-unified')).toBeNull();

    const splitTable = target.querySelector('.diff-table-split');
    expect(splitTable).not.toBeNull();

    const contextRow = splitTable.querySelector('.diff-split-line-context');
    expect(contextRow.querySelector('.diff-line-number-old').textContent).toBe('1');
    expect(contextRow.querySelector('.diff-line-number-new').textContent).toBe('1');
    expect(contextRow.querySelector('.diff-code-old').textContent).toBe('context');
    expect(contextRow.querySelector('.diff-code-new').textContent).toBe('context');

    const changeRows = splitTable.querySelectorAll('.diff-split-line-change');
    expect(changeRows).toHaveLength(2);

    expect(changeRows[0].querySelector('.diff-line-number-old').textContent).toBe('2');
    expect(changeRows[0].querySelector('.diff-marker-old').textContent).toBe('−');
    expect(changeRows[0].querySelector('.diff-code-old').textContent).toBe('removed');
    expect(changeRows[0].querySelector('.diff-line-number-new').textContent).toBe('2');
    expect(changeRows[0].querySelector('.diff-marker-new').textContent).toBe('+');
    expect(changeRows[0].querySelector('.diff-code-new').textContent).toBe('added1');

    expect(changeRows[1].querySelector('.diff-line-number-old').textContent).toBe('');
    expect(changeRows[1].querySelector('.diff-marker-old').textContent).toBe('');
    expect(changeRows[1].querySelector('.diff-code-old').textContent).toBe('');
    expect(changeRows[1].querySelector('.diff-line-number-new').textContent).toBe('3');
    expect(changeRows[1].querySelector('.diff-marker-new').textContent).toBe('+');
    expect(changeRows[1].querySelector('.diff-code-new').textContent).toBe('added2');

    expect(
      target
        .querySelector('.diff-view-toggle-button[data-diff-view-mode="unified"]')
        .getAttribute('aria-pressed')
    ).toBe('false');
    expect(
      target
        .querySelector('.diff-view-toggle-button[data-diff-view-mode="split"]')
        .getAttribute('aria-pressed')
    ).toBe('true');
  });

  it('can render split view first when configured', () => {
    new DiffRenderer({ viewMode: 'split' }).render(SAMPLE, target);

    expect(target.dataset.diffViewMode).toBe('split');
    expect(target.querySelector('.diff-table-split')).not.toBeNull();
    expect(target.querySelector('.diff-table-unified')).toBeNull();
    expect(
      target
        .querySelector('.diff-view-toggle-button[data-diff-view-mode="split"]')
        .getAttribute('aria-pressed')
    ).toBe('true');
  });

  it('renders a fallback "Diff file" with a no-hunks message for empty input', () => {
    // parseUnifiedDiff('') yields one section whose meta holds the single blank
    // line, so the 'No diff content found.' branch is not reached here; an
    // untitled section with no hunks is produced instead.
    const outline = new DiffRenderer().render('', target);
    expect(outline.files).toHaveLength(1);
    expect(target.querySelector('.diff-file-title').textContent).toBe('Diff file');
    expect(target.querySelector('.diff-empty').textContent).toBe('No hunks in this diff file.');
  });

  it('shows a no-hunk message for a file with metadata but no hunks', () => {
    new DiffRenderer().render('diff --git a/x.js b/x.js\n--- a/x.js\n+++ b/x.js\n', target);
    expect(target.querySelector('.diff-file .diff-empty').textContent).toBe(
      'No hunks in this diff file.'
    );
  });
});
