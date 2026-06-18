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
