// Icons rendered from JavaScript are emitted as self-contained inline SVG.
// They cannot point at public/assets/icons/sprite.svg, because these helpers
// also run in the content script, where the markup is inserted into the page
// that is being previewed. On a file:// page an external <use> reference is
// blocked ("file: URLs are treated as unique security origins") and the icon
// silently disappears, so the path data has to travel with the markup.
// Icons written directly into the extension's own HTML pages keep using the
// sprite file, so an icon is defined here or there ("arrow-right" is the one
// shape both need).
const ICONS = {
  copy: {
    viewBox: '0 0 16 16',
    attributes:
      'fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"',
    content:
      '<rect x="5.75" y="5.75" width="8" height="8" rx="1.6" /><path d="M3.5 10.25H3A1.5 1.5 0 0 1 1.5 8.75V3A1.5 1.5 0 0 1 3 1.5h5.75A1.5 1.5 0 0 1 10.25 3v.5" />'
  },
  check: {
    viewBox: '0 0 16 16',
    attributes:
      'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"',
    content: '<path d="M13.25 4.5 6.5 11.5 2.75 7.75" />'
  },
  file: {
    viewBox: '0 0 16 16',
    attributes: 'fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"',
    content: '<path d="M3.75 2.25H9.25L12.25 5.25V13.75H3.75Z" /><path d="M9.25 2.25V5.25H12.25" />'
  },
  folder: {
    viewBox: '0 0 16 16',
    attributes: 'fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"',
    content: '<path d="M2 5.25H6.25L7.75 6.75H14V12.5H2Z" />'
  },
  'folder-open': {
    viewBox: '0 0 16 16',
    attributes: 'fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"',
    content:
      '<path d="M2.25 12.25V5H6.25L7.75 6.5H13.75V8.25" stroke-linecap="round" /><path d="M2.25 12.25 4 7.75H15.25L13.5 12.25Z" />'
  },
  'pin-tab': {
    viewBox: '0 0 16 16',
    attributes:
      'fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"',
    content:
      '<path d="M8 11.25V14" /><path d="M5.75 2.25H10.25C10.8 2.25 11.25 2.7 11.25 3.25C11.25 3.8 10.8 4.25 10.25 4.25V6.75C10.25 7.31 10.56 7.82 11.05 8.07L12.04 8.56C12.47 8.78 12.75 9.22 12.75 9.71V10.25H3.25V9.71C3.25 9.22 3.53 8.78 3.96 8.56L4.95 8.07C5.44 7.82 5.75 7.31 5.75 6.75V4.25C5.2 4.25 4.75 3.8 4.75 3.25C4.75 2.7 5.2 2.25 5.75 2.25Z" />'
  },
  'pin-tab-filled': {
    viewBox: '0 0 16 16',
    attributes:
      'stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"',
    content:
      '<path d="M8 10.95V14" fill="none" /><path d="M5.75 2.25H10.25C10.8 2.25 11.25 2.7 11.25 3.25C11.25 3.8 10.8 4.25 10.25 4.25V6.75C10.25 7.31 10.56 7.82 11.05 8.07L12.04 8.56C12.47 8.78 12.75 9.22 12.75 9.71V10.25H3.25V9.71C3.25 9.22 3.53 8.78 3.96 8.56L4.95 8.07C5.44 7.82 5.75 7.31 5.75 6.75V4.25C5.2 4.25 4.75 3.8 4.75 3.25C4.75 2.7 5.2 2.25 5.75 2.25Z" fill="currentColor" stroke="none" />'
  },
  'arrow-up': {
    viewBox: '0 0 16 16',
    attributes:
      'fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"',
    content: '<path d="M3.5 10.5 8 6 12.5 10.5" />'
  },
  'arrow-down': {
    viewBox: '0 0 16 16',
    attributes:
      'fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"',
    content: '<path d="M3.5 5.5 8 10 12.5 5.5" />'
  },
  'arrow-right': {
    viewBox: '0 0 16 16',
    attributes:
      'fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"',
    content: '<path d="M6 3.5 10.5 8 6 12.5" />'
  },
  'arrow-right-small': {
    viewBox: '0 0 12 12',
    attributes:
      'fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"',
    content: '<path d="M4.5 2.75 7.75 6 4.5 9.25" />'
  },
  expand: {
    viewBox: '0 0 24 24',
    attributes:
      'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"',
    content:
      '<path d="M8 3H5a2 2 0 0 0-2 2v3" /><path d="M16 3h3a2 2 0 0 1 2 2v3" /><path d="M8 21H5a2 2 0 0 1-2-2v-3" /><path d="M16 21h3a2 2 0 0 0 2-2v-3" />'
  },
  'zoom-in': {
    viewBox: '0 0 24 24',
    attributes:
      'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"',
    content:
      '<circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5 21 21" /><path d="M10.5 7.75v5.5M7.75 10.5h5.5" />'
  },
  'zoom-out': {
    viewBox: '0 0 24 24',
    attributes:
      'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"',
    content:
      '<circle cx="10.5" cy="10.5" r="6.5" /><path d="M15.5 15.5 21 21" /><path d="M7.75 10.5h5.5" />'
  },
  'fit-screen': {
    viewBox: '0 0 24 24',
    attributes:
      'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"',
    content:
      '<path d="M4 9V6a2 2 0 0 1 2-2h3" /><path d="M20 9V6a2 2 0 0 0-2-2h-3" /><path d="M4 15v3a2 2 0 0 0 2 2h3" /><path d="M20 15v3a2 2 0 0 1-2 2h-3" />'
  },
  close: {
    viewBox: '0 0 24 24',
    attributes:
      'fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"',
    content: '<path d="M6 6 18 18M18 6 6 18" />'
  }
};

export const ICON_IDS = Object.freeze(Object.keys(ICONS));

function icon(id, className = '') {
  const { viewBox, attributes, content } = ICONS[id];
  return `<svg class="${className}" viewBox="${viewBox}" ${attributes} aria-hidden="true" focusable="false">${content}</svg>`;
}

export function getCopyIcon(className = '') {
  return icon('copy', className);
}

export function getCheckIcon(className = '') {
  return icon('check', className);
}

export function getArrowRightSmallIcon(className = '') {
  return icon('arrow-right-small', className);
}

export function getArrowRightIcon(className = '') {
  return icon('arrow-right', className);
}

export function getFolderClosedIcon(className = '') {
  return icon('folder', className);
}

export function getFolderOpenIcon(className = '') {
  return icon('folder-open', className);
}

export function getFileIcon(className = '') {
  return icon('file', className);
}

export function getPinIcon(className = '') {
  return icon('pin-tab', className);
}

export function getPinFilledIcon(className = '') {
  return icon('pin-tab-filled', className);
}

export function getArrowUpIcon(className = '') {
  return icon('arrow-up', className);
}

export function getArrowDownIcon(className = '') {
  return icon('arrow-down', className);
}

export function getExpandIcon(className = '') {
  return icon('expand', className);
}

export function getZoomInIcon(className = '') {
  return icon('zoom-in', className);
}

export function getZoomOutIcon(className = '') {
  return icon('zoom-out', className);
}

export function getFitScreenIcon(className = '') {
  return icon('fit-screen', className);
}

export function getCloseIcon(className = '') {
  return icon('close', className);
}
