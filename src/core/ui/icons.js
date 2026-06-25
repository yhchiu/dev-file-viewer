// All icons live in a single SVG sprite (public/assets/icons/sprite.svg) so the
// path data has one source of truth. Each helper returns an <svg> that references
// a sprite <symbol> via <use>, keeping the dynamic className API and currentColor
// theming that callers rely on. The path is relative to the viewer page, which is
// the only page that imports these helpers.
const SPRITE = '../assets/icons/sprite.svg';

function icon(id, className = '') {
  return `<svg class="${className}" aria-hidden="true" focusable="false"><use href="${SPRITE}#${id}" /></svg>`;
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
