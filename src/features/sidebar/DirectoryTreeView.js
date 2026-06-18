import { t } from '../../core/i18n/i18n.js';
import {
  getArrowRightSmallIcon,
  getFolderClosedIcon,
  getFolderOpenIcon,
  getFileIcon
} from '../../core/ui/icons.js';

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
      disclosure.setAttribute(
        'aria-label',
        t(collapsed ? 'a11yExpandSection' : 'a11yCollapseSection', [folderName])
      );
      // eslint-disable-next-line no-unsanitized/property -- trusted static SVG icon
      disclosure.innerHTML = getArrowRightSmallIcon('tree-arrow-icon');
      disclosure.addEventListener('click', event => {
        event.preventDefault();
        event.stopPropagation();
        this.toggleFolder(path);
      });

      const label = document.createElement('button');
      label.type = 'button';
      label.className = 'tree-folder';
      label.dataset.path = path;
      label.dataset.expanded = String(!collapsed);
      label.title = path || folderName;
      // eslint-disable-next-line no-unsanitized/property -- trusted static SVG icons; label text set via textContent below
      label.innerHTML =
        getFolderClosedIcon('tree-item-icon tree-folder-icon tree-folder-icon-closed') +
        getFolderOpenIcon('tree-item-icon tree-folder-icon tree-folder-icon-open') +
        '<span class="tree-folder-label"></span>';
      label.querySelector('.tree-folder-label').textContent = folderName;
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
    button.title = node.path;
    button.dataset.path = node.path;
    // eslint-disable-next-line no-unsanitized/property -- trusted static SVG icon + markup; label text set via textContent below
    button.innerHTML =
      '<span class="tree-file-spacer" aria-hidden="true"></span><span class="tree-file-inner">' +
      getFileIcon('tree-item-icon tree-file-icon') +
      '<span class="tree-file-label"></span></span>';
    button.querySelector('.tree-file-label').textContent = node.name;
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
    const button = Array.from(this.container.querySelectorAll('.tree-file')).find(
      candidate => candidate.dataset.path === path
    );
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
      const label = Array.from(this.container.querySelectorAll('.tree-folder')).find(
        candidate => (candidate.dataset.path || '') === path
      );
      if (label) label.dataset.expanded = String(!collapsed);
      const name = label?.textContent || t('treeFolderFallback');
      disclosure.setAttribute(
        'aria-label',
        t(collapsed ? 'a11yExpandSection' : 'a11yCollapseSection', [name])
      );
    }
  }
}
