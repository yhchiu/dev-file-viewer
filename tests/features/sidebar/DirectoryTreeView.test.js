import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DirectoryTreeView } from '../../../src/features/sidebar/DirectoryTreeView.js';

const tree = {
  type: 'directory',
  name: 'proj',
  path: '',
  children: [
    {
      type: 'directory',
      name: 'src',
      path: 'src',
      children: [{ type: 'file', name: 'a.js', path: 'src/a.js' }]
    },
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
    expect(
      container.querySelector('.tree-disclosure[data-path=""]').getAttribute('aria-expanded')
    ).toBe('true');
    expect(
      container.querySelector('.tree-disclosure[data-path="src"]').getAttribute('aria-expanded')
    ).toBe('false');
    expect(container.querySelector('.tree-children[data-path=""]').hidden).toBe(false);
    expect(container.querySelector('.tree-children[data-path="src"]').hidden).toBe(true);
    expect(container.querySelectorAll('.tree-arrow-icon')).toHaveLength(2);
    expect(container.querySelectorAll('.tree-folder-icon-closed')).toHaveLength(2);
    expect(container.querySelectorAll('.tree-folder-icon-open')).toHaveLength(2);
    const files = container.querySelectorAll('.tree-file');
    expect([...files].map(b => b.textContent)).toEqual(['a.js', 'README.md']);
    expect(container.querySelectorAll('.tree-file-spacer')).toHaveLength(2);
    expect(container.querySelectorAll('.tree-file-icon')).toHaveLength(2);
    expect(files[0].title).toBe('src/a.js');
  });

  it('toggles folder visibility from the disclosure and label', () => {
    view.render(tree, () => {});
    const disclosure = container.querySelector('.tree-disclosure[data-path="src"]');
    const label = container.querySelector('.tree-folder[data-path="src"]');
    const children = container.querySelector('.tree-children[data-path="src"]');

    disclosure.click();
    expect(children.hidden).toBe(false);
    expect(disclosure.getAttribute('aria-expanded')).toBe('true');

    label.click();
    expect(children.hidden).toBe(true);
    expect(disclosure.getAttribute('aria-expanded')).toBe('false');
  });

  it('invokes the callback and marks the clicked file active', () => {
    const onSelect = vi.fn();
    view.render(tree, onSelect);
    container.querySelector('.tree-disclosure[data-path="src"]').click();
    const button = container.querySelector('.tree-file[data-path="src/a.js"]');
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

  it('expands ancestor folders when marking an active file by path', () => {
    view.render(tree, () => {});
    const srcChildren = container.querySelector('.tree-children[data-path="src"]');
    expect(srcChildren.hidden).toBe(true);

    view.markActivePath('src/a.js');

    expect(srcChildren.hidden).toBe(false);
    expect(
      container.querySelector('.tree-disclosure[data-path="src"]').getAttribute('aria-expanded')
    ).toBe('true');
    expect(container.querySelector('.tree-file.active').dataset.path).toBe('src/a.js');
  });
});
