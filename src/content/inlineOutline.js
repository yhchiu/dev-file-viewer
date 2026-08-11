// Outline entries for the Inline Preview popover.
//
// The viewer builds three different outlines (Markdown headings, changed diff
// files, source code symbols) from tree builders in core/. Inline Preview shows
// a single flat popover, so this module normalizes all three into one row shape
// and leaves the DOM work to inlinePreview.js.
//
// entry:
//   id       unique row key (data-heading-id)
//   kind     'heading' | 'diff-directory' | 'diff-file' | 'source-symbol'
//   text     primary label
//   level    1..6, drives the popover indent
//   element  scroll target; null for diff directories, which only group rows
//   anchorId fragment the row links to (empty for diff directories)
//   badge    leading pill, e.g. the localized symbol kind
//   meta     trailing detail, e.g. '+12 −3' or 'L42'
//   title    tooltip, usually the full path
import { buildHeadingIndex } from '../core/toc/headingIndex.js';
import { buildDiffOutlineTree } from '../core/diff/diffOutlineTree.js';
import { buildSourceSymbolTree, extractSourceSymbols } from '../core/source/sourceSymbols.js';
import { symbolKindLabel } from '../core/source/symbolLabels.js';

const MAX_HEADING_LEVEL = 6;

function createEntry(values) {
  return {
    id: values.id,
    kind: values.kind,
    text: values.text || '',
    level: Math.min(Math.max(Number(values.level) || 1, 1), MAX_HEADING_LEVEL),
    element: values.element || null,
    anchorId: values.anchorId || '',
    badge: values.badge || '',
    meta: values.meta || '',
    title: values.title || values.text || ''
  };
}

export function buildMarkdownOutlineEntries(preview) {
  if (!preview) return [];

  return buildHeadingIndex(preview, { maxLevel: MAX_HEADING_LEVEL }).map(heading =>
    createEntry({
      id: heading.id,
      kind: 'heading',
      text: heading.text,
      level: heading.level,
      element: heading.element,
      anchorId: heading.id
    })
  );
}

export function buildDiffOutlineEntries(files = []) {
  if (!files.length) return [];

  return buildDiffOutlineTree(files).nodes.map(node =>
    node.kind === 'diff-directory'
      ? createEntry({
          id: node.id,
          kind: 'diff-directory',
          text: node.text,
          level: node.level,
          title: node.path
        })
      : createEntry({
          id: node.id,
          kind: 'diff-file',
          text: node.text,
          level: node.level,
          element: node.element,
          anchorId: node.id,
          meta: `+${node.stats?.added || 0} −${node.stats?.removed || 0}`,
          title: node.path || node.text
        })
  );
}

export function buildSourceOutlineEntries(text, language, preview) {
  if (!preview) return [];

  const symbols = extractSourceSymbols(text || '', { language });
  if (!symbols.length) return [];

  return buildSourceSymbolTree(symbols, preview).symbolNodes.map(node =>
    createEntry({
      id: node.id,
      kind: 'source-symbol',
      text: node.text,
      level: node.level,
      element: node.element,
      anchorId: node.anchorId,
      badge: symbolKindLabel(node.symbolKind),
      meta: `L${node.line}`
    })
  );
}
