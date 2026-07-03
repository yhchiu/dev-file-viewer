import { describe, it, expect } from 'vitest';
import {
  fileTabGroupBounds,
  FileTabsController
} from '../../../src/viewer/controllers/FileTabsController.js';

const tabs = pinFlags => pinFlags.map((pinned, i) => ({ key: `t${i}`, pinned }));

// Build a controller wired only enough to exercise the pure reorder logic.
const controllerWith = openTabs => {
  const controller = new FileTabsController({ elements: {} });
  controller.openTabs = openTabs.map(t => ({ ...t }));
  return controller;
};

const keysOf = controller => controller.openTabs.map(t => t.key);

describe('fileTabGroupBounds', () => {
  it('splits a mixed list at the first unpinned tab', () => {
    const list = tabs([true, true, false, false]);
    expect(fileTabGroupBounds(list, true)).toEqual({ start: 0, end: 2 });
    expect(fileTabGroupBounds(list, false)).toEqual({ start: 2, end: 4 });
  });

  it('treats an all-pinned list as one pinned group', () => {
    const list = tabs([true, true]);
    expect(fileTabGroupBounds(list, true)).toEqual({ start: 0, end: 2 });
    expect(fileTabGroupBounds(list, false)).toEqual({ start: 2, end: 2 });
  });

  it('treats an all-unpinned list as one unpinned group', () => {
    const list = tabs([false, false, false]);
    expect(fileTabGroupBounds(list, true)).toEqual({ start: 0, end: 0 });
    expect(fileTabGroupBounds(list, false)).toEqual({ start: 0, end: 3 });
  });

  it('handles an empty list', () => {
    expect(fileTabGroupBounds([], true)).toEqual({ start: 0, end: 0 });
    expect(fileTabGroupBounds([], false)).toEqual({ start: 0, end: 0 });
  });
});

describe('commitFileTabDrag', () => {
  it('moves a tab to the end of its group', () => {
    const controller = controllerWith(tabs([false, false, false, false]));
    controller.commitFileTabDrag('t1', false, 3);
    expect(keysOf(controller)).toEqual(['t0', 't2', 't3', 't1']);
  });

  it('moves a tab to the front of its group', () => {
    const controller = controllerWith(tabs([false, false, false, false]));
    controller.commitFileTabDrag('t2', false, 0);
    expect(keysOf(controller)).toEqual(['t2', 't0', 't1', 't3']);
  });

  it('keeps an unpinned tab inside the unpinned group', () => {
    const controller = controllerWith(tabs([true, true, false, false]));
    // t3 is the second unpinned tab; group-index 0 = first unpinned slot.
    controller.commitFileTabDrag('t3', false, 0);
    expect(keysOf(controller)).toEqual(['t0', 't1', 't3', 't2']);
  });

  it('keeps a pinned tab inside the pinned group', () => {
    const controller = controllerWith(tabs([true, true, false, false]));
    controller.commitFileTabDrag('t0', true, 1);
    expect(keysOf(controller)).toEqual(['t1', 't0', 't2', 't3']);
  });

  it('is a no-op when the target slot equals the current slot', () => {
    const controller = controllerWith(tabs([false, false, false]));
    controller.commitFileTabDrag('t1', false, 1);
    expect(keysOf(controller)).toEqual(['t0', 't1', 't2']);
  });
});
