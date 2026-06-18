import { describe, it, expect } from 'vitest';
import { clampSidebarWidth } from '../../../src/viewer/controllers/SidebarController.js';

describe('clampSidebarWidth', () => {
  const WIDE = 2000; // viewport wide enough that the 560px max applies

  it('keeps an in-range width (rounded)', () => {
    expect(clampSidebarWidth(400, WIDE)).toBe(400);
    expect(clampSidebarWidth(400.6, WIDE)).toBe(401);
  });

  it('clamps to the [240, 560] bounds on a wide viewport', () => {
    expect(clampSidebarWidth(100, WIDE)).toBe(240);
    expect(clampSidebarWidth(9999, WIDE)).toBe(560);
  });

  it('limits the max to 60% of the viewport width', () => {
    // 600 * 0.6 = 360 -> max becomes 360
    expect(clampSidebarWidth(500, 600)).toBe(360);
    // very narrow viewport never drops below the 240 minimum
    expect(clampSidebarWidth(500, 300)).toBe(240);
  });

  it('falls back to the default for non-positive / non-finite input', () => {
    expect(clampSidebarWidth(0, WIDE)).toBe(322);
    expect(clampSidebarWidth(-50, WIDE)).toBe(322);
    expect(clampSidebarWidth(NaN, WIDE)).toBe(322);
  });
});
