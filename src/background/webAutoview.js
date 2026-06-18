// Manages the http(s) auto-open content script as an opt-in feature.
//
// By default the extension ships with no broad host access, so the autoview
// content script is only registered for file:// pages (static, in the
// manifest). When the user opts in from Settings, Chrome grants the optional
// http(s) host permission and we register the same script dynamically. This
// keeps the default install free of the "read your data on all websites"
// warning while preserving the feature for those who want it.

export const WEB_AUTOVIEW_SCRIPT_ID = 'autoview-web';
export const WEB_AUTOVIEW_ORIGINS = ['http://*/*', 'https://*/*'];

const WEB_AUTOVIEW_SCRIPT = {
  id: WEB_AUTOVIEW_SCRIPT_ID,
  matches: WEB_AUTOVIEW_ORIGINS,
  js: ['content/markdown-autoview.js'],
  runAt: 'document_idle',
  persistAcrossSessions: true
};

export async function hasWebAutoviewPermission() {
  try {
    return await chrome.permissions.contains({ origins: WEB_AUTOVIEW_ORIGINS });
  } catch {
    return false;
  }
}

async function isWebAutoviewRegistered() {
  try {
    const scripts = await chrome.scripting.getRegisteredContentScripts({
      ids: [WEB_AUTOVIEW_SCRIPT_ID]
    });
    return scripts.length > 0;
  } catch {
    return false;
  }
}

export async function registerWebAutoview() {
  if (await isWebAutoviewRegistered()) return;
  try {
    await chrome.scripting.registerContentScripts([WEB_AUTOVIEW_SCRIPT]);
  } catch (error) {
    console.warn('Dev File Viewer: failed to register web autoview script', error);
  }
}

export async function unregisterWebAutoview() {
  if (!(await isWebAutoviewRegistered())) return;
  try {
    await chrome.scripting.unregisterContentScripts({ ids: [WEB_AUTOVIEW_SCRIPT_ID] });
  } catch (error) {
    console.warn('Dev File Viewer: failed to unregister web autoview script', error);
  }
}

// Reconcile the dynamic registration with the current permission state. Safe to
// call on startup, install, and whenever the web host permission changes.
export async function syncWebAutoviewRegistration() {
  if (await hasWebAutoviewPermission()) {
    await registerWebAutoview();
  } else {
    await unregisterWebAutoview();
  }
}

// True when a permissions change event touches the web origins we care about.
export function affectsWebOrigins(permissions = {}) {
  const origins = permissions?.origins || [];
  return origins.some(origin => WEB_AUTOVIEW_ORIGINS.includes(origin) || origin === '<all_urls>');
}
