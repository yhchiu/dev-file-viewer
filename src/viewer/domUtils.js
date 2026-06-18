// Small DOM scheduling helpers shared by the viewer app and its controllers.

/** Resolve after the next animation frame (lets the browser paint/layout first). */
export function nextFrame() {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}
