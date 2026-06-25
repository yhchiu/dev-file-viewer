import { features } from '../core/config/features.js';
import { t } from '../core/i18n/i18n.js';
import {
  getExpandIcon,
  getZoomInIcon,
  getZoomOutIcon,
  getFitScreenIcon,
  getCloseIcon
} from '../core/ui/icons.js';

// Complex Mermaid diagrams and large embedded images are hard to read at the
// content width the viewer renders them in. This plugin adds a "zoom" affordance
// to each rendered diagram/image that opens a shared full-viewport lightbox with
// wheel zoom, drag pan, fit/reset and keyboard support, so detailed charts can be
// inspected without leaving the document.
//
// It runs purely on the already-sanitised, already-rendered DOM (it clones nodes
// and attaches listeners; it never injects untrusted HTML), so it does not weaken
// the MarkdownEngine sanitisation guarantees. It is registered after mermaidPlugin
// so the diagram <svg> elements already exist when afterRender runs.

const MIN_SCALE = 0.2;
const MAX_SCALE = 12;
const WHEEL_STEP = 1.12;
const BUTTON_STEP = 1.35;
// Leave a little breathing room around the diagram when fitting to the viewport.
const FIT_MARGIN = 0.94;

const EXPAND_ICON = getExpandIcon('diagram-zoom-icon');

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

let lightbox = null;

export const diagramZoomPlugin = {
  id: 'diagram-zoom',
  enabled: features.plugins.diagramZoom,

  async afterRender(root) {
    if (!root) return;

    const targets = [
      ...root.querySelectorAll('.mermaid svg'),
      // Skip linked images so the link still wins the click, and skip images the
      // plugin already enhanced on a previous pass over the same container.
      ...[...root.querySelectorAll('img')].filter(
        img => !img.closest('a') && !img.closest('.zoomable-image')
      )
    ];

    for (const target of targets) {
      attachZoom(target);
    }
  }
};

function attachZoom(media) {
  const container = wrapMedia(media);
  if (!container || container.dataset.diagramZoom === 'ready') return;
  container.dataset.diagramZoom = 'ready';

  media.classList.add('is-zoomable');

  const trigger = document.createElement('button');
  trigger.type = 'button';
  trigger.className = 'diagram-zoom-trigger';
  trigger.title = t('a11yZoomOpen');
  trigger.setAttribute('aria-label', t('a11yZoomOpen'));
  // eslint-disable-next-line no-unsanitized/property -- trusted static SVG icon constant
  trigger.innerHTML = EXPAND_ICON;
  trigger.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    openLightbox(media, trigger);
  });

  container.append(trigger);

  // The whole media is also clickable for discoverability; the button remains the
  // keyboard-accessible entry point.
  media.addEventListener('click', () => openLightbox(media, trigger));
}

// Mermaid diagrams already live in a positioned `.mermaid` block we can hang the
// trigger off; bare images get wrapped in an inline-block span so the absolutely
// positioned trigger has a positioning context without disturbing page flow.
function wrapMedia(media) {
  const mermaidBlock = media.closest('.mermaid');
  if (mermaidBlock) return mermaidBlock;

  if (media.parentElement?.classList.contains('zoomable-image')) {
    return media.parentElement;
  }

  const wrapper = document.createElement('span');
  wrapper.className = 'zoomable-image';
  media.replaceWith(wrapper);
  wrapper.append(media);
  return wrapper;
}

function openLightbox(media, trigger) {
  if (!lightbox) lightbox = createLightbox();
  lightbox.open(media, trigger);
}

function createLightbox() {
  const overlay = document.createElement('div');
  overlay.className = 'diagram-lightbox';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('aria-label', t('a11yZoomView'));
  overlay.hidden = true;

  const stage = document.createElement('div');
  stage.className = 'diagram-lightbox-stage';

  const content = document.createElement('div');
  content.className = 'diagram-lightbox-content';
  stage.append(content);

  const toolbar = document.createElement('div');
  toolbar.className = 'diagram-lightbox-toolbar';

  const zoomOutBtn = toolbarButton(getZoomOutIcon('diagram-zoom-icon'), 'a11yZoomOut');
  const zoomInBtn = toolbarButton(getZoomInIcon('diagram-zoom-icon'), 'a11yZoomIn');
  const resetBtn = toolbarButton(getFitScreenIcon('diagram-zoom-icon'), 'a11yZoomReset');
  const closeBtn = toolbarButton(getCloseIcon('diagram-zoom-icon'), 'a11yZoomClose');

  toolbar.append(zoomOutBtn, zoomInBtn, resetBtn, closeBtn);
  overlay.append(toolbar, stage);
  document.body.append(overlay);

  // View state: a translate()+scale() transform with origin at the content's
  // top-left, so zoom-toward-cursor math stays simple.
  let scale = 1;
  let tx = 0;
  let ty = 0;
  let baseW = 0;
  let baseH = 0;
  let stageW = 0;
  let stageH = 0;
  let allowUpscaleFit = true;
  let lastTrigger = null;

  const apply = () => {
    content.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  };

  const fit = () => {
    const stageRect = stage.getBoundingClientRect();
    stageW = stageRect.width;
    stageH = stageRect.height;
    if (!baseW || !baseH) return;

    let fitScale = Math.min(stageW / baseW, stageH / baseH) * FIT_MARGIN;
    // Raster images look bad upscaled past their native size, so cap the initial
    // fit at 1x for them; vector diagrams may grow to fill the viewport.
    if (!allowUpscaleFit) fitScale = Math.min(fitScale, 1);
    scale = clamp(fitScale, MIN_SCALE, MAX_SCALE);
    tx = (stageW - baseW * scale) / 2;
    ty = (stageH - baseH * scale) / 2;
    apply();
  };

  const zoomAt = (px, py, factor) => {
    const newScale = clamp(scale * factor, MIN_SCALE, MAX_SCALE);
    const ratio = newScale / scale;
    tx = px - (px - tx) * ratio;
    ty = py - (py - ty) * ratio;
    scale = newScale;
    apply();
  };

  const zoomFromCenter = factor => zoomAt(stageW / 2, stageH / 2, factor);

  const close = () => {
    overlay.hidden = true;
    content.replaceChildren();
    document.body.classList.remove('diagram-lightbox-open');
    document.removeEventListener('keydown', onKeydown, true);
    lastTrigger?.focus?.();
    lastTrigger = null;
  };

  function onKeydown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === '+' || event.key === '=') {
      event.preventDefault();
      zoomFromCenter(BUTTON_STEP);
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault();
      zoomFromCenter(1 / BUTTON_STEP);
    } else if (event.key === '0') {
      event.preventDefault();
      fit();
    } else if (event.key === 'Tab') {
      // Minimal focus trap: keep focus on the toolbar controls.
      event.preventDefault();
      const order = [zoomOutBtn, zoomInBtn, resetBtn, closeBtn];
      const current = order.indexOf(document.activeElement);
      const delta = event.shiftKey ? -1 : 1;
      order[(current + delta + order.length) % order.length].focus();
    }
  }

  zoomInBtn.addEventListener('click', () => zoomFromCenter(BUTTON_STEP));
  zoomOutBtn.addEventListener('click', () => zoomFromCenter(1 / BUTTON_STEP));
  resetBtn.addEventListener('click', fit);
  closeBtn.addEventListener('click', close);

  // Click on the backdrop padding (outside the stage) closes; clicks on the stage
  // are reserved for panning.
  overlay.addEventListener('mousedown', event => {
    if (event.target === overlay) close();
  });

  stage.addEventListener(
    'wheel',
    event => {
      event.preventDefault();
      const rect = stage.getBoundingClientRect();
      const factor = event.deltaY < 0 ? WHEEL_STEP : 1 / WHEEL_STEP;
      zoomAt(event.clientX - rect.left, event.clientY - rect.top, factor);
    },
    { passive: false }
  );

  stage.addEventListener('dblclick', event => {
    event.preventDefault();
    fit();
  });

  let panning = false;
  let moved = false;
  let downOnEmpty = false;
  let startX = 0;
  let startY = 0;
  let startTx = 0;
  let startTy = 0;

  stage.addEventListener('pointerdown', event => {
    panning = true;
    moved = false;
    // A press that starts off the diagram (on the dark backdrop) is a candidate
    // for click-to-close; a press on the diagram is only ever a pan.
    downOnEmpty = !content.contains(event.target);
    startX = event.clientX;
    startY = event.clientY;
    startTx = tx;
    startTy = ty;
    stage.setPointerCapture?.(event.pointerId);
    stage.classList.add('is-panning');
  });

  stage.addEventListener('pointermove', event => {
    if (!panning) return;
    const dx = event.clientX - startX;
    const dy = event.clientY - startY;
    if (!moved && Math.hypot(dx, dy) > 5) moved = true;
    tx = startTx + dx;
    ty = startTy + dy;
    apply();
  });

  const endPan = event => {
    if (!panning) return;
    panning = false;
    stage.releasePointerCapture?.(event.pointerId);
    stage.classList.remove('is-panning');
    // A click (not a drag) on the empty backdrop closes the view, matching the
    // common lightbox gesture; clicks on the diagram and pans are preserved.
    if (!moved && downOnEmpty) close();
  };

  stage.addEventListener('pointerup', endPan);
  stage.addEventListener('pointercancel', endPan);

  return {
    open(media, trigger) {
      lastTrigger = trigger || null;
      allowUpscaleFit = media.tagName.toLowerCase() !== 'img';

      const rect = media.getBoundingClientRect();
      baseW = rect.width || media.clientWidth || 1;
      baseH = rect.height || media.clientHeight || 1;

      const clone = media.cloneNode(true);
      clone.classList.remove('is-zoomable');
      // Keep the original id: mermaid scopes its generated <style> to the SVG's
      // id (e.g. `#mermaid-1 .node rect { fill: ... }`), so stripping it would
      // drop every fill/stroke and the diagram would render as black shapes. The
      // duplicate id is harmless here — it is removed again when the view closes.
      clone.style.width = `${baseW}px`;
      clone.style.height = `${baseH}px`;
      clone.style.maxWidth = 'none';
      clone.style.maxHeight = 'none';
      clone.style.margin = '0';
      content.replaceChildren(clone);

      if (!overlay.isConnected) document.body.append(overlay);
      overlay.hidden = false;
      document.body.classList.add('diagram-lightbox-open');
      document.addEventListener('keydown', onKeydown, true);
      fit();
      closeBtn.focus();
    },
    close,
    overlay
  };
}

function toolbarButton(iconHtml, labelKey) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'diagram-lightbox-btn';
  button.title = t(labelKey);
  button.setAttribute('aria-label', t(labelKey));
  // eslint-disable-next-line no-unsanitized/property -- trusted static SVG icon constant
  button.innerHTML = iconHtml;
  return button;
}
