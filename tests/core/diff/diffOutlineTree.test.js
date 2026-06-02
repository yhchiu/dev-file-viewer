import { describe, it, expect } from 'vitest';
import { buildDiffOutlineTree } from '../../../src/core/diff/diffOutlineTree.js';

describe('buildDiffOutlineTree', () => {
  it('places a root-level file directly under the tree', () => {
    const tree = buildDiffOutlineTree([{ id: 'f1', path: 'README.md', stats: { added: 2, removed: 1 } }]);
    expect(tree.fileNodes).toHaveLength(1);
    expect(tree.nodes).toHaveLength(1);
    const file = tree.nodes[0];
    expect(file.kind).toBe('diff-file');
    expect(file.text).toBe('README.md');
    expect(file.stats).toEqual({ added: 2, removed: 1 });
    expect(file.level).toBe(1);
    expect(file.parentIds).toEqual([]);
  });

  it('collapses a single shared top-level chain into the root', () => {
    // No root-level sibling → the common src/core prefix folds away and the
    // files surface at level 1 with no directory node.
    const tree = buildDiffOutlineTree([
      { id: 'a', path: 'src/core/a.js' },
      { id: 'b', path: 'src/core/b.js' }
    ]);
    expect(tree.nodes.every(n => n.kind === 'diff-file')).toBe(true);
    expect(tree.nodes.map(f => f.text).sort()).toEqual(['a.js', 'b.js']);
    expect(tree.nodes[0].level).toBe(1);
  });

  it('compacts single-child directory chains when a root sibling exists', () => {
    const tree = buildDiffOutlineTree([
      { id: 'x', path: 'pkg/sub/x.js' },
      { id: 'r', path: 'top.md' }
    ]);
    const dir = tree.nodes.find(n => n.kind === 'diff-directory');
    expect(dir.text).toBe('pkg/sub');
    expect(dir.level).toBe(1);
    expect(dir.hasChildren).toBe(true);

    const xFile = tree.nodes.find(n => n.text === 'x.js');
    expect(xFile.level).toBe(2);
    expect(xFile.parentIds).toEqual([dir.id]);
    expect(tree.nodes.find(n => n.text === 'top.md').level).toBe(1);
  });

  it('defaults missing stats and produces unique ids', () => {
    const tree = buildDiffOutlineTree([{ id: 'x', path: 'a/x.js' }, { id: 'y', path: 'b/y.js' }]);
    expect(tree.fileNodes[0].stats).toEqual({ added: 0, removed: 0 });
    const ids = tree.nodes.map(n => n.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
