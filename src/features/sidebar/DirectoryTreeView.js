import { t } from '../../core/i18n/i18n.js';

export class DirectoryTreeView {
  constructor(container) {
    this.container = container;
    this.activePath = '';
  }

  render(tree, onFileSelected) {
    this.container.classList.remove('empty');
    this.container.textContent = '';
    const rootList = document.createElement('ul');
    rootList.className = 'tree-root';
    rootList.append(this.renderNode(tree, onFileSelected));
    this.container.append(rootList);
  }

  renderNode(node, onFileSelected) {
    const item = document.createElement('li');
    item.className = 'tree-node';

    if (node.type === 'directory') {
      const label = document.createElement('div');
      label.className = 'tree-folder';
      label.textContent = `▾ ${node.name || t('treeFolderFallback')}`;
      item.append(label);

      const children = document.createElement('ul');
      children.className = 'tree-children';
      for (const child of node.children) {
        children.append(this.renderNode(child, onFileSelected));
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
    this.markActive(button);
  }

  showEmpty(message) {
    this.container.classList.add('empty');
    this.container.textContent = message;
  }
}

