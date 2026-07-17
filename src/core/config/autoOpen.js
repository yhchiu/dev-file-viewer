export const AUTO_OPEN_KEY = 'devFileViewer:autoOpen';

export const DEFAULT_AUTO_OPEN_CONFIG = Object.freeze({
  enabled: true,
  inlinePreview: false,
  disabled: Object.freeze([])
});

export function normalizeAutoOpenConfig(value = {}) {
  const disabled = Array.isArray(value?.disabled)
    ? [...new Set(value.disabled.filter(item => typeof item === 'string' && item))]
    : [];

  return {
    enabled: value?.enabled !== false,
    inlinePreview: value?.inlinePreview === true,
    disabled
  };
}

export async function loadAutoOpenConfig(storageArea = chrome.storage.local) {
  try {
    const stored = await storageArea.get(AUTO_OPEN_KEY);
    return normalizeAutoOpenConfig(stored?.[AUTO_OPEN_KEY]);
  } catch {
    return normalizeAutoOpenConfig();
  }
}

export function isAutoOpenEnabledFor(config, key) {
  const normalized = normalizeAutoOpenConfig(config);
  return normalized.enabled && !normalized.disabled.includes(key);
}
