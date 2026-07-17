import { describe, expect, it, vi } from 'vitest';
import {
  AUTO_OPEN_KEY,
  isAutoOpenEnabledFor,
  loadAutoOpenConfig,
  normalizeAutoOpenConfig
} from '../../../src/core/config/autoOpen.js';

describe('auto-open config', () => {
  it('defaults auto-open to enabled and Inline Preview to disabled', () => {
    expect(normalizeAutoOpenConfig()).toEqual({
      enabled: true,
      inlinePreview: false,
      disabled: []
    });
  });

  it('preserves explicit disabled settings and removes invalid duplicate keys', () => {
    expect(
      normalizeAutoOpenConfig({
        enabled: false,
        inlinePreview: false,
        disabled: ['.md', '.md', '', null, '.js']
      })
    ).toEqual({
      enabled: false,
      inlinePreview: false,
      disabled: ['.md', '.js']
    });
  });

  it('loads and normalizes the stored config', async () => {
    const storage = {
      get: vi.fn(async () => ({
        [AUTO_OPEN_KEY]: { inlinePreview: false, disabled: ['.patch'] }
      }))
    };

    await expect(loadAutoOpenConfig(storage)).resolves.toEqual({
      enabled: true,
      inlinePreview: false,
      disabled: ['.patch']
    });
  });

  it('falls back to defaults when storage is unavailable', async () => {
    const storage = { get: vi.fn(async () => Promise.reject(new Error('unavailable'))) };
    await expect(loadAutoOpenConfig(storage)).resolves.toEqual({
      enabled: true,
      inlinePreview: false,
      disabled: []
    });
  });

  it('checks the master switch and per-type disabled list', () => {
    expect(isAutoOpenEnabledFor({ enabled: true, disabled: [] }, '.md')).toBe(true);
    expect(isAutoOpenEnabledFor({ enabled: true, disabled: ['.md'] }, '.md')).toBe(false);
    expect(isAutoOpenEnabledFor({ enabled: false, disabled: [] }, '.md')).toBe(false);
  });
});
