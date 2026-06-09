function cleanSvg(str) {
  return str.replace(/>\s+</g, '><').trim();
}

export function getCopyIcon(className = '') {
  return cleanSvg(`<svg class="${className}" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <rect x="5.75" y="5.75" width="8" height="8" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" />
    <path d="M3.5 10.25H3A1.5 1.5 0 0 1 1.5 8.75V3A1.5 1.5 0 0 1 3 1.5h5.75A1.5 1.5 0 0 1 10.25 3v.5" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
  </svg>`);
}

export function getCheckIcon(className = '') {
  return cleanSvg(`<svg class="${className}" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path d="M13.25 4.5 6.5 11.5 2.75 7.75" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" />
  </svg>`);
}

export function getArrowRightSmallIcon(className = '') {
  return cleanSvg(`<svg class="${className}" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
    <path d="M4.5 2.75 7.75 6 4.5 9.25" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
  </svg>`);
}

export function getArrowRightIcon(className = '') {
  return cleanSvg(`<svg class="${className}" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" />
  </svg>`);
}

export function getFolderClosedIcon(className = '') {
  return cleanSvg(`<svg class="${className}" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path d="M2 5.25H6.25L7.75 6.75H14V12.5H2Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" />
  </svg>`);
}

export function getFolderOpenIcon(className = '') {
  return cleanSvg(`<svg class="${className}" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path d="M2.25 12.25V5H6.25L7.75 6.5H13.75V8.25" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" />
    <path d="M2.25 12.25 4 7.75H15.25L13.5 12.25Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" />
  </svg>`);
}

export function getFileIcon(className = '') {
  return cleanSvg(`<svg class="${className}" viewBox="0 0 16 16" aria-hidden="true" focusable="false">
    <path d="M3.75 2.25H9.25L12.25 5.25V13.75H3.75Z" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" />
    <path d="M9.25 2.25V5.25H12.25" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" />
  </svg>`);
}
