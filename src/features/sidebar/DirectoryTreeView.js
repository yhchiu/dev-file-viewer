import { t } from '../../core/i18n/i18n.js';

export class DirectoryTreeView {
  constructor(container) {
    this.container = container;
    this.activePath = '';
    this.collapsedPaths = new Set();
  }

  render(tree, onFileSelected) {
    this.container.classList.remove('empty');
    this.container.textContent = '';
    this.collapsedPaths = new Set();
    const rootList = document.createElement('ul');
    rootList.className = 'tree-root';
    rootList.append(this.renderNode(tree, onFileSelected, 0));
    this.container.append(rootList);
  }

  renderNode(node, onFileSelected, depth) {
    const item = document.createElement('li');
    item.className = 'tree-node';

    if (node.type === 'directory') {
      const folderName = node.name || t('treeFolderFallback');
      const path = node.path || '';
      const collapsed = depth > 0;
      if (collapsed) this.collapsedPaths.add(path);

      const row = document.createElement('div');
      row.className = 'tree-folder-row';

      const disclosure = document.createElement('button');
      disclosure.type = 'button';
      disclosure.className = 'tree-disclosure';
      disclosure.dataset.path = path;
      disclosure.setAttribute('aria-expanded', String(!collapsed));
      disclosure.setAttribute('aria-label', t(collapsed ? 'a11yExpandSection' : 'a11yCollapseSection', [folderName]));
      disclosure.innerHTML = `
        <svg class="button-icon" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
          <path d="M5.75 3.5 10.25 8l-4.5 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      `;
      disclosure.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        this.toggleFolder(path);
      });

      const label = document.createElement('button');
      label.type = 'button';
      label.className = 'tree-folder';
      label.dataset.path = path;
      label.textContent = folderName;
      label.title = path || folderName;
      label.addEventListener('click', event => {
        event.preventDefault();
        this.toggleFolder(path);
      });
      row.append(disclosure, label);
      item.append(row);

      const children = document.createElement('ul');
      children.className = 'tree-children';
      children.dataset.path = path;
      children.hidden = collapsed;
      for (const child of node.children) {
        children.append(this.renderNode(child, onFileSelected, depth + 1));
      }
      item.append(children);
      return item;
    }

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tree-file';
    button.textContent = node.name;
    button.title = node.path;
    button.dataset.path = node.path;
    button.addEventListener('click', () => {
      this.activePath = node.path;
      this.markActive(button);
      onFileSelected(node);
    });
    item.append(button);
    return item;
  }

  markActive(activeButton) {
    for (const button of this.container.querySelectorAll('.tree-file.active')) {
      button.classList.remove('active');
    }
    activeButton.classList.add('active');
  }

  markActivePath(path) {
    const button = Array.from(this.container.querySelectorAll('.tree-file'))
      .find(candidate => candidate.dataset.path === path);
    if (!button) return;
    this.activePath = path;
    this.expandAncestors(path);
    this.markActive(button);
  }

  showEmpty(message) {
    this.container.classList.add('empty');
    this.container.textContent = message;
  }

  toggleFolder(path) {
    if (this.collapsedPaths.has(path)) this.collapsedPaths.delete(path);
    else this.collapsedPaths.add(path);
    this.applyFolderState(path);
  }

  expandAncestors(filePath) {
    for (const children of this.container.querySelectorAll('.tree-children')) {
      const path = children.dataset.path || '';
      const isAncestor = path === '' || filePath === path || filePath.startsWith(`${path}/`);
      if (!isAncestor) continue;
      this.collapsedPaths.delete(path);
      this.applyFolderState(path);
    }
  }

  applyFolderState(path) {
    const collapsed = this.collapsedPaths.has(path);
    for (const children of this.container.querySelectorAll('.tree-children')) {
      if ((children.dataset.path || '') !== path) continue;
      children.hidden = collapsed;
    }
    for (const disclosure of this.container.querySelectorAll('.tree-disclosure')) {
      if ((disclosure.dataset.path || '') !== path) continue;
      disclosure.setAttribute('aria-expanded', String(!collapsed));
      const label = Array.from(this.container.querySelectorAll('.tree-folder'))
        .find(candidate => (candidate.dataset.path || '') === path);
      const name = label?.textContent || t('treeFolderFallback');
      disclosure.setAttribute('aria-label', t(collapsed ? 'a11yExpandSection' : 'a11yCollapseSection', [name]));
    }
  }
}
