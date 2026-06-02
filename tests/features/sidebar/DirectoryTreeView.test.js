import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DirectoryTreeView } from '../../../src/features/sidebar/DirectoryTreeView.js';

const tree = {
  type: 'directory',
  name: 'proj',
  path: '',
  children: [
    { type: 'directory', name: 'src', path: 'src', children: [
      { type: 'file', name: 'a.js', path: 'src/a.js' }
    ] },
    { type: 'file', name: 'README.md', path: 'README.md' }
  ]
};

let container;
let view;
beforeEach(() => {
  container = document.createElement('div');
  container.classList.add('empty');
  view = new DirectoryTreeView(container);
});

describe('DirectoryTreeView', () => {
  it('renders folders and files and clears the empty state', () => {
    view.render(tree, () => {});
    expect(container.classList.contains('empty')).toBe(false);
    expect(container.querySelectorAll('.tree-folder')).toHaveLength(2); // proj + src
    const files = container.querySelectorAll('.tree-file');
    expect([...files].map(b => b.textContent)).toEqual(['a.js', 'README.md']);
    expect(files[0].title).toBe('src/a.js');
  });

  it('invokes the callback and marks the clicked file active', () => {
    const onSelect = vi.fn();
    view.render(tree, onSelect);
    const button = container.querySelector('.tree-file');
    button.click();
    expect(onSelect).toHaveBeenCalledWith({ type: 'file', name: 'a.js', path: 'src/a.js' });
    expect(button.classList.contains('active')).toBe(true);
    expect(view.activePath).toBe('src/a.js');
  });

  it('markActivePath activates by path and showEmpty resets', () => {
    view.render(tree, () => {});
    view.markActivePath('README.md');
    const active = container.querySelector('.tree-file.active');
    expect(active.dataset.path).toBe('README.md');

    view.showEmpty('nothing here');
    expect(container.classList.contains('empty')).toBe(true);
    expect(container.textContent).toBe('nothing here');
  });
});
