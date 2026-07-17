import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  affectsWebOrigins,
  syncWebAutoviewRegistration,
  WEB_AUTOVIEW_ORIGINS,
  WEB_AUTOVIEW_SCRIPT_ID
} from '../../src/background/webAutoview.js';

describe('webAutoview', () => {
  let registered;

  beforeEach(() => {
    registered = [];
    chrome.permissions = {
      contains: vi.fn(async () => false)
    };
    chrome.scripting = {
      getRegisteredContentScripts: vi.fn(async ({ ids } = {}) =>
        registered.filter(script => !ids || ids.includes(script.id))
      ),
      registerContentScripts: vi.fn(async scripts => {
        registered.push(...scripts);
      }),
      unregisterContentScripts: vi.fn(async ({ ids } = {}) => {
        registered = registered.filter(script => !ids || !ids.includes(script.id));
      })
    };
  });

  afterEach(() => {
    delete chrome.permissions;
    delete chrome.scripting;
  });

  describe('affectsWebOrigins', () => {
    it('is true for the web origins and <all_urls>', () => {
      expect(affectsWebOrigins({ origins: ['https://*/*'] })).toBe(true);
      expect(affectsWebOrigins({ origins: ['http://*/*'] })).toBe(true);
      expect(affectsWebOrigins({ origins: ['<all_urls>'] })).toBe(true);
    });

    it('is false for unrelated or missing origins', () => {
      expect(affectsWebOrigins({ origins: ['file:///*'] })).toBe(false);
      expect(affectsWebOrigins({})).toBe(false);
      expect(affectsWebOrigins()).toBe(false);
    });
  });

  describe('syncWebAutoviewRegistration', () => {
    it('registers the script when the web permission is granted', async () => {
      chrome.permissions.contains.mockResolvedValue(true);

      await syncWebAutoviewRegistration();

      expect(chrome.scripting.registerContentScripts).toHaveBeenCalledTimes(1);
      const [scripts] = chrome.scripting.registerContentScripts.mock.calls[0];
      expect(scripts[0].id).toBe(WEB_AUTOVIEW_SCRIPT_ID);
      expect(scripts[0].matches).toEqual(WEB_AUTOVIEW_ORIGINS);
      expect(scripts[0].css).toEqual(['content/inline-preview.css']);
      expect(scripts[0].js).toEqual(['content/markdown-autoview.js']);
    });

    it('does not register twice when already registered', async () => {
      chrome.permissions.contains.mockResolvedValue(true);

      await syncWebAutoviewRegistration();
      await syncWebAutoviewRegistration();

      expect(chrome.scripting.registerContentScripts).toHaveBeenCalledTimes(1);
    });

    it('replaces an older registration that does not include Inline Preview CSS', async () => {
      chrome.permissions.contains.mockResolvedValue(true);
      registered.push({
        id: WEB_AUTOVIEW_SCRIPT_ID,
        matches: WEB_AUTOVIEW_ORIGINS,
        js: ['content/markdown-autoview.js'],
        runAt: 'document_idle',
        persistAcrossSessions: true
      });

      await syncWebAutoviewRegistration();

      expect(chrome.scripting.unregisterContentScripts).toHaveBeenCalledTimes(1);
      expect(chrome.scripting.registerContentScripts).toHaveBeenCalledTimes(1);
      expect(registered[0].css).toEqual(['content/inline-preview.css']);
    });

    it('unregisters the script when the permission is revoked', async () => {
      chrome.permissions.contains.mockResolvedValue(true);
      await syncWebAutoviewRegistration();

      chrome.permissions.contains.mockResolvedValue(false);
      await syncWebAutoviewRegistration();

      expect(chrome.scripting.unregisterContentScripts).toHaveBeenCalledTimes(1);
      expect(registered).toHaveLength(0);
    });

    it('does nothing when there is no permission and nothing registered', async () => {
      chrome.permissions.contains.mockResolvedValue(false);

      await syncWebAutoviewRegistration();

      expect(chrome.scripting.registerContentScripts).not.toHaveBeenCalled();
      expect(chrome.scripting.unregisterContentScripts).not.toHaveBeenCalled();
    });
  });
});
