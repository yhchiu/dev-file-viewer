function normalizePath(value = '') {
  return (
    String(value || '')
      .replace(/\\/g, '/')
      .replace(/^[ab]\//, '')
      .replace(/\/+/g, '/')
      .replace(/^\/+/, '')
      .replace(/\/+$/, '') || 'unknown'
  );
}

function slugPart(value = '') {
  return (
    String(value || 'item')
      .toLowerCase()
      .replace(/[^a-z0-9._/-]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'item'
  );
}

function makeDirectoryId(path) {
  return `diff-dir-${slugPart(path).replace(/[/.]+/g, '-')}`;
}

function createDirectory(name, path) {
  return {
    id: makeDirectoryId(path),
    kind: 'diff-directory',
    text: name,
    path,
    level: 1,
    parentIds: [],
    children: [],
    childDirectoryByName: new Map(),
    childFileByName: new Map(),
    hasChildren: true
  };
}

function createFile(file, fileName, path) {
  return {
    id: file.id,
    kind: 'diff-file',
    text: fileName,
    path,
    filePath: path,
    stats: file.stats || { added: 0, removed: 0 },
    element: file.element,
    level: 1,
    parentIds: [],
    children: [],
    hasChildren: false
  };
}

export function buildDiffOutlineTree(files = []) {
  const root = createDirectory('', '');
  const normalizedFiles = [];

  for (const file of files) {
    const filePath = normalizePath(file.path || file.filePath || file.text || file.id || '');
    const parts = filePath.split('/').filter(Boolean);
    const fileName = parts.pop() || filePath;
    let parent = root;
    let currentPath = '';

    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}/${part}` : part;
      let directory = parent.childDirectoryByName.get(part);
      if (!directory) {
        directory = createDirectory(part, currentPath);
        parent.childDirectoryByName.set(part, directory);
        parent.children.push(directory);
      }
      parent = directory;
    }

    const fileNode = createFile(file, fileName, filePath);
    parent.childFileByName.set(fileName, fileNode);
    parent.children.push(fileNode);
    normalizedFiles.push(fileNode);
  }

  compactDirectoryTree(root);

  const nodes = [];
  const byId = new Map();

  function walk(node, level, parentIds) {
    for (const child of node.children || []) {
      child.level = level;
      child.parentIds = [...parentIds];
      child.hasChildren = Boolean(child.children?.length);
      nodes.push(child);
      byId.set(child.id, child);

      if (child.children?.length) {
        walk(child, level + 1, [...parentIds, child.id]);
      }
    }
  }

  walk(root, 1, []);

  return {
    nodes,
    roots: root.children || [],
    byId,
    fileNodes: normalizedFiles
  };
}

function compactDirectoryTree(node) {
  for (const child of node.children || []) {
    if (child.kind === 'diff-directory') compactDirectoryTree(child);
  }

  if (node.kind !== 'diff-directory') return node;
  if (node.children.length !== 1) return node;

  const onlyChild = node.children[0];
  if (onlyChild.kind !== 'diff-directory') return node;

  node.text = node.text ? `${node.text}/${onlyChild.text}` : onlyChild.text;
  node.path = onlyChild.path;
  node.id = makeDirectoryId(node.path);
  node.children = onlyChild.children;
  node.childDirectoryByName = onlyChild.childDirectoryByName;
  node.childFileByName = onlyChild.childFileByName;

  return compactDirectoryTree(node);
}
