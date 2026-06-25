import { describe, it, expect, afterEach } from 'vitest';
import { diagramZoomPlugin } from '../../src/plugins/diagramZoomPlugin.js';

function rootWith(html) {
  const root = document.createElement('div');
  root.className = 'markdown-body';
  root.innerHTML = html;
  document.body.append(root);
  return root;
}

afterEach(() => {
  document.body.innerHTML = '';
  document.querySelector('.diagram-lightbox')?.remove();
});

describe('diagramZoomPlugin.afterRender', () => {
  it('wraps a bare image and adds a zoom trigger', async () => {
    const root = rootWith('<p><img src="diagram.png" alt="chart" /></p>');
    await diagramZoomPlugin.afterRender(root);

    const wrapper = root.querySelector('.zoomable-image');
    expect(wrapper).not.toBeNull();
    expect(wrapper.querySelector('img')).not.toBeNull();
    expect(wrapper.querySelector('button.diagram-zoom-trigger')).not.toBeNull();
    expect(root.querySelector('img.is-zoomable')).not.toBeNull();
  });

  it('skips images wrapped in a link so the link still wins the click', async () => {
    const root = rootWith('<p><a href="https://x.test"><img src="badge.svg" alt="" /></a></p>');
    await diagramZoomPlugin.afterRender(root);

    expect(root.querySelector('.zoomable-image')).toBeNull();
    expect(root.querySelector('.diagram-zoom-trigger')).toBeNull();
  });

  it('enhances a rendered mermaid diagram in place', async () => {
    const root = rootWith('<div class="mermaid"><svg><rect /></svg></div>');
    await diagramZoomPlugin.afterRender(root);

    const block = root.querySelector('.mermaid');
    expect(block.querySelector('svg.is-zoomable')).not.toBeNull();
    expect(block.querySelector(':scope > button.diagram-zoom-trigger')).not.toBeNull();
  });

  it('is idempotent across repeated renders (no duplicate triggers)', async () => {
    const root = rootWith('<p><img src="diagram.png" alt="chart" /></p>');
    await diagramZoomPlugin.afterRender(root);
    await diagramZoomPlugin.afterRender(root);

    expect(root.querySelectorAll('.diagram-zoom-trigger')).toHaveLength(1);
    expect(root.querySelectorAll('.zoomable-image')).toHaveLength(1);
  });

  it('opens a shared lightbox on trigger click and closes it', async () => {
    const root = rootWith('<p><img src="diagram.png" alt="chart" /></p>');
    await diagramZoomPlugin.afterRender(root);

    root.querySelector('.diagram-zoom-trigger').click();

    const overlay = document.querySelector('.diagram-lightbox');
    expect(overlay).not.toBeNull();
    expect(overlay.hidden).toBe(false);
    // A clone of the media is mounted into the zoom stage.
    expect(overlay.querySelector('.diagram-lightbox-content img')).not.toBeNull();
    expect(overlay.getAttribute('role')).toBe('dialog');

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(overlay.hidden).toBe(true);
    expect(overlay.querySelector('.diagram-lightbox-content img')).toBeNull();
  });

  it('keeps the mermaid SVG id on the clone so id-scoped styles still apply', async () => {
    const root = rootWith('<div class="mermaid"><svg id="mermaid-7"><rect /></svg></div>');
    await diagramZoomPlugin.afterRender(root);

    root.querySelector('.diagram-zoom-trigger').click();

    const clone = document.querySelector('.diagram-lightbox-content svg');
    expect(clone).not.toBeNull();
    expect(clone.id).toBe('mermaid-7');
  });

  it('closes when clicking the empty backdrop area (no drag)', async () => {
    const root = rootWith('<p><img src="diagram.png" alt="chart" /></p>');
    await diagramZoomPlugin.afterRender(root);
    root.querySelector('.diagram-zoom-trigger').click();

    const overlay = document.querySelector('.diagram-lightbox');
    const stage = overlay.querySelector('.diagram-lightbox-stage');
    expect(overlay.hidden).toBe(false);

    stage.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 5, clientY: 5 }));
    stage.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: 5, clientY: 5 }));

    expect(overlay.hidden).toBe(true);
  });

  it('keeps the view open when clicking the diagram itself', async () => {
    const root = rootWith('<p><img src="diagram.png" alt="chart" /></p>');
    await diagramZoomPlugin.afterRender(root);
    root.querySelector('.diagram-zoom-trigger').click();

    const overlay = document.querySelector('.diagram-lightbox');
    const clone = overlay.querySelector('.diagram-lightbox-content img');

    clone.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 5, clientY: 5 }));
    clone.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: 5, clientY: 5 }));

    expect(overlay.hidden).toBe(false);
  });

  it('does not close when the backdrop press was a drag (pan)', async () => {
    const root = rootWith('<p><img src="diagram.png" alt="chart" /></p>');
    await diagramZoomPlugin.afterRender(root);
    root.querySelector('.diagram-zoom-trigger').click();

    const overlay = document.querySelector('.diagram-lightbox');
    const stage = overlay.querySelector('.diagram-lightbox-stage');

    stage.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 5, clientY: 5 }));
    stage.dispatchEvent(new MouseEvent('pointermove', { bubbles: true, clientX: 80, clientY: 80 }));
    stage.dispatchEvent(new MouseEvent('pointerup', { bubbles: true, clientX: 80, clientY: 80 }));

    expect(overlay.hidden).toBe(false);
  });

  it('does nothing when there is no zoomable media', async () => {
    const root = rootWith('<p>just text</p>');
    await diagramZoomPlugin.afterRender(root);

    expect(root.querySelector('.zoomable-image')).toBeNull();
    expect(document.querySelector('.diagram-lightbox')).toBeNull();
  });
});
