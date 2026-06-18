import { describe, it, expect } from 'vitest';
import {
  clampToBounds,
  collectDescendantIds
} from '../../../src/viewer/controllers/OutlineController.js';

describe('clampToBounds', () => {
  const bounds = { minLeft: 10, minTop: 10, maxRight: 200, maxBottom: 200 };
  const size = { width: 50, height: 40 };

  it('keeps an in-range position', () => {
    expect(clampToBounds({ left: 80, top: 60 }, bounds, size)).toEqual({ left: 80, top: 60 });
  });

  it('clamps to the min edges', () => {
    expect(clampToBounds({ left: -100, top: -100 }, bounds, size)).toEqual({ left: 10, top: 10 });
  });

  it('clamps to the max edges (maxRight/Bottom minus size)', () => {
    // maxLeft = 200 - 50 = 150, maxTop = 200 - 40 = 160
    expect(clampToBounds({ left: 999, top: 999 }, bounds, size)).toEqual({ left: 150, top: 160 });
  });
});

describe('collectDescendantIds', () => {
  it('gathers all descendant ids depth-first', () => {
    const tree = {
      id: 'root',
      children: [
        { id: 'a', children: [{ id: 'a1', children: [] }] },
        { id: 'b', children: [] }
      ]
    };
    const set = new Set();
    collectDescendantIds(tree, set);
    expect([...set].sort()).toEqual(['a', 'a1', 'b']);
  });

  it('is a no-op for leaf or missing nodes', () => {
    const set = new Set();
    collectDescendantIds({ id: 'x', children: [] }, set);
    collectDescendantIds(null, set);
    expect(set.size).toBe(0);
  });
});
