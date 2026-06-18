import { describe, it, expect } from 'vitest';
import {
  ScrollMemoryController,
  resolveRestoreScrollTop
} from '../../../src/viewer/controllers/ScrollMemoryController.js';

describe('resolveRestoreScrollTop', () => {
  it('prefers an explicit finite option scrollTop (including 0)', () => {
    expect(resolveRestoreScrollTop(240, 50)).toBe(50);
    expect(resolveRestoreScrollTop(240, 0)).toBe(0);
  });

  it('falls back to the saved top, then to 0', () => {
    expect(resolveRestoreScrollTop(240, undefined)).toBe(240);
    expect(resolveRestoreScrollTop(undefined, undefined)).toBe(0);
    expect(resolveRestoreScrollTop(NaN, NaN)).toBe(0);
  });
});

function makeHost() {
  return {
    elements: { rememberScroll: { checked: false } },
    scrollRoot: { scrollTop: 0 },
    currentDocKey: 'doc-1',
    getDocumentKey: doc => doc.key,
    scrollToAnchor: () => false,
    fileTabs: { saveActiveTabRuntimeScroll: () => {} },
    outline: { scheduleActiveHeadingUpdate: () => {} },
    setStatus: () => {}
  };
}

describe('ScrollMemoryController.restoreOrResetScroll', () => {
  it('applies the saved position when enabled', async () => {
    const host = makeHost();
    const controller = new ScrollMemoryController(host);
    controller.enabled = true;
    controller.positions = { 'doc-1': { top: 240 } };

    await controller.restoreOrResetScroll({ key: 'doc-1' });

    expect(host.scrollRoot.scrollTop).toBe(240);
  });

  it('resets to the top when there is no saved position', async () => {
    const host = makeHost();
    host.scrollRoot.scrollTop = 500;
    const controller = new ScrollMemoryController(host);
    controller.enabled = true;

    await controller.restoreOrResetScroll({ key: 'unknown' });

    expect(host.scrollRoot.scrollTop).toBe(0);
  });

  it('honors an explicit scrollTop option over the saved position', async () => {
    const host = makeHost();
    const controller = new ScrollMemoryController(host);
    controller.enabled = true;
    controller.positions = { 'doc-1': { top: 240 } };

    await controller.restoreOrResetScroll({ key: 'doc-1' }, { scrollTop: 99 });

    expect(host.scrollRoot.scrollTop).toBe(99);
  });

  it('ignores saved positions when disabled', async () => {
    const host = makeHost();
    host.scrollRoot.scrollTop = 12;
    const controller = new ScrollMemoryController(host);
    controller.enabled = false;
    controller.positions = { 'doc-1': { top: 240 } };

    await controller.restoreOrResetScroll({ key: 'doc-1' });

    expect(host.scrollRoot.scrollTop).toBe(0);
  });
});
