export const VIEWER_FONT_SIZE_KEY = 'devFileViewer:viewerFontSize';
export const DEFAULT_VIEWER_FONT_SIZE = 15;
export const MIN_VIEWER_FONT_SIZE = 12;
export const MAX_VIEWER_FONT_SIZE = 24;

/** Clamp/round a viewer font size to the supported range, falling back to the default. */
export function clampViewerFontSize(value) {
  const numericSize = Number(value);
  if (!Number.isFinite(numericSize)) return DEFAULT_VIEWER_FONT_SIZE;
  return Math.min(Math.max(Math.round(numericSize), MIN_VIEWER_FONT_SIZE), MAX_VIEWER_FONT_SIZE);
}

export function viewerFontSizeProgress(value) {
  const fontSize = clampViewerFontSize(value);
  return ((fontSize - MIN_VIEWER_FONT_SIZE) / (MAX_VIEWER_FONT_SIZE - MIN_VIEWER_FONT_SIZE)) * 100;
}
