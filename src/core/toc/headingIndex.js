export const DEFAULT_TOC_MAX_LEVEL = 3;

export function ensureHeadingAnchors(root) {
  const used = new Set(Array.from(root.querySelectorAll('[id]')).map(element => element.id).filter(Boolean));

  for (const heading of root.querySelectorAll('h1, h2, h3, h4, h5, h6')) {
    if (heading.id) continue;

    const base = slugify(heading.textContent || 'section') || 'section';
    let slug = base;
    let index = 1;
    while (used.has(slug)) slug = `${base}-${index++}`;

    heading.id = slug;
    used.add(slug);
  }
}

export function buildHeadingIndex(root, options = {}) {
  const maxLevel = Number.isFinite(options.maxLevel) ? options.maxLevel : DEFAULT_TOC_MAX_LEVEL;

  return Array.from(root.querySelectorAll('h1, h2, h3, h4, h5, h6'))
    .map(element => ({
      id: element.id,
      text: normalizeHeadingText(element.textContent),
      level: getHeadingLevel(element),
      element
    }))
    .filter(heading => heading.id && heading.text && heading.level <= maxLevel);
}

export function buildHeadingTree(headings) {
  const nodes = [];
  const roots = [];
  const byId = new Map();
  const stack = [];

  for (const heading of headings) {
    const node = {
      ...heading,
      parentIds: [],
      children: [],
      childIds: [],
      hasChildren: false
    };

    while (stack.length && stack[stack.length - 1].level >= node.level) {
      stack.pop();
    }

    const parent = stack[stack.length - 1];
    if (parent) {
      node.parentIds = [...parent.parentIds, parent.id];
      parent.children.push(node);
      parent.childIds.push(node.id);
      parent.hasChildren = true;
    } else {
      roots.push(node);
    }

    nodes.push(node);
    byId.set(node.id, node);
    stack.push(node);
  }

  return { nodes, roots, byId };
}

export function normalizeHeadingText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

export function getHeadingLevel(element) {
  const level = Number(String(element.tagName || '').replace(/^H/i, ''));
  return Number.isFinite(level) ? level : 6;
}

export function slugify(value) {
  return String(value)
    .trim()
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}
