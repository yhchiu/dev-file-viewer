import { describe, it, expect } from 'vitest';
import { fileTabGroupBounds } from '../../../src/viewer/controllers/FileTabsController.js';

const tabs = pinFlags => pinFlags.map((pinned, i) => ({ key: `t${i}`, pinned }));

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
