import {
  copyExtensionSettingsUrl,
  isFileUrlAccessAllowed,
  openExtensionSettings
} from '../core/browser/fileUrlAccess.js';
import { localizeDocument, t } from '../core/i18n/i18n.js';
import { AUTO_OPEN_CATEGORIES } from '../core/format/fileTypes.js';
import { syncChromeTheme } from '../core/ui/chromeTheme.js';

const AUTO_OPEN_KEY = 'devFileViewer:autoOpen';
const WEB_ACCESS_ORIGINS = ['http://*/*', 'https://*/*'];
const CHANGELOG_FILE = 'CHANGELOG.json';
const CHANGELOG_REPO_URL = 'https://github.com/yhchiu/dev-file-viewer';
const CHANGELOG_TYPE_LABEL_KEYS = {
  feat: 'changelogTypeAdded',
  fix: 'changelogTypeFixed',
  refactor: 'changelogTypeChanged',
  perf: 'changelogTypeChanged',
  style: 'changelogTypeChanged',
  ui: 'changelogTypeChanged',
  docs: 'changelogTypeDocs',
  test: 'changelogTypeMaintenance',
  build: 'changelogTypeMaintenance',
  ci: 'changelogTypeMaintenance',
  chore: 'changelogTypeMaintenance',
  revert: 'changelogTypeReverted'
};

localizeDocument();

/* ---------- Category navigation ---------- */

function setupCategoryNav() {
  const navItems = [...document.querySelectorAll('[data-settings-nav]')];
  const panels = [...document.querySelectorAll('[data-settings-panel]')];
  const ids = navItems.map(item => item.dataset.settingsNav);

  function select(id) {
    for (const item of navItems) {
      const active = item.dataset.settingsNav === id;
      item.classList.toggle('active', active);
      item.setAttribute('aria-selected', String(active));
    }
    for (const panel of panels) {
      panel.hidden = panel.dataset.settingsPanel !== id;
    }
    history.replaceState(null, '', `#${id}`);
  }

  for (const item of navItems) {
    item.addEventListener('click', () => select(item.dataset.settingsNav));
  }

  // Allow deep-linking to a category, e.g. settings/index.html#about.
  const requested = location.hash.slice(1);
  select(ids.includes(requested) ? requested : ids[0]);
}

/* ---------- Auto-open config ---------- */

const config = { enabled: true, disabled: new Set() };

async function loadConfig() {
  try {
    const stored = await chrome.storage.local.get(AUTO_OPEN_KEY);
    const saved = stored[AUTO_OPEN_KEY] || {};
    config.enabled = saved.enabled !== false;
    config.disabled = new Set(Array.isArray(saved.disabled) ? saved.disabled : []);
  } catch {
    config.enabled = true;
    config.disabled = new Set();
  }
}

let savedFlagTimer = 0;

async function persistConfig() {
  await chrome.storage.local.set({
    [AUTO_OPEN_KEY]: { enabled: config.enabled, disabled: [...config.disabled] }
  });

  const flag = document.querySelector('#auto-open-saved');
  if (!flag) return;
  flag.hidden = false;
  clearTimeout(savedFlagTimer);
  savedFlagTimer = setTimeout(() => {
    flag.hidden = true;
  }, 1600);
}

function buildTypeList() {
  const container = document.querySelector('#auto-open-types');
  container.textContent = '';

  for (const category of AUTO_OPEN_CATEGORIES) {
    const group = document.createElement('section');
    group.className = 'type-group';

    const header = document.createElement('label');
    header.className = 'type-group-header';
    const groupCheckbox = document.createElement('input');
    groupCheckbox.type = 'checkbox';
    groupCheckbox.dataset.groupId = category.id;
    groupCheckbox.addEventListener('change', () => {
      for (const item of category.items) {
        if (groupCheckbox.checked) config.disabled.delete(item.key);
        else config.disabled.add(item.key);
      }
      persistConfig();
      syncUI();
    });
    const groupName = document.createElement('span');
    groupName.textContent = t(category.labelKey);
    header.append(groupCheckbox, groupName);
    group.append(header);

    const grid = document.createElement('div');
    grid.className = 'type-grid';
    for (const item of category.items) {
      const label = document.createElement('label');
      label.className = 'type-item';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.dataset.typeKey = item.key;
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) config.disabled.delete(item.key);
        else config.disabled.add(item.key);
        persistConfig();
        syncUI();
      });
      const name = document.createElement('span');
      name.textContent = item.label;
      label.append(checkbox, name);
      grid.append(label);
    }
    group.append(grid);
    container.append(group);
  }
}

function syncUI() {
  const master = document.querySelector('#auto-open-master');
  master.checked = config.enabled;

  document.querySelector('#auto-open-types').classList.toggle('is-disabled', !config.enabled);

  for (const category of AUTO_OPEN_CATEGORIES) {
    let checkedCount = 0;
    for (const item of category.items) {
      const checkbox = document.querySelector(`input[data-type-key="${CSS.escape(item.key)}"]`);
      if (!checkbox) continue;
      const on = !config.disabled.has(item.key);
      checkbox.checked = on;
      checkbox.disabled = !config.enabled;
      if (on) checkedCount += 1;
    }

    const groupCheckbox = document.querySelector(
      `input[data-group-id="${CSS.escape(category.id)}"]`
    );
    if (groupCheckbox) {
      groupCheckbox.checked = checkedCount === category.items.length;
      groupCheckbox.indeterminate = checkedCount > 0 && checkedCount < category.items.length;
      groupCheckbox.disabled = !config.enabled;
    }
  }
}

function setupAutoOpenControls() {
  document.querySelector('#auto-open-master').addEventListener('change', event => {
    config.enabled = event.target.checked;
    persistConfig();
    syncUI();
  });

  document.querySelector('#auto-open-reset').addEventListener('click', () => {
    config.enabled = true;
    config.disabled = new Set();
    persistConfig();
    syncUI();
  });
}

/* ---------- Website access (opt-in http/https) ---------- */

async function refreshWebAccessToggle() {
  const toggle = document.querySelector('#web-access-toggle');
  if (!toggle) return;
  try {
    toggle.checked = await chrome.permissions.contains({ origins: WEB_ACCESS_ORIGINS });
  } catch {
    toggle.checked = false;
  }
}

function setupWebAccessToggle() {
  const toggle = document.querySelector('#web-access-toggle');
  if (!toggle) return;

  toggle.addEventListener('change', async () => {
    // Must call request()/remove() directly off the user gesture. The service
    // worker reacts to permissions.onAdded/onRemoved to (un)register the script.
    try {
      if (toggle.checked) {
        toggle.checked = await chrome.permissions.request({ origins: WEB_ACCESS_ORIGINS });
      } else {
        await chrome.permissions.remove({ origins: WEB_ACCESS_ORIGINS });
        await refreshWebAccessToggle();
      }
    } catch {
      await refreshWebAccessToggle();
    }
  });
}

/* ---------- file:// access status ---------- */

async function refreshFileUrlStatus() {
  const card = document.querySelector('#file-url-card');
  const status = document.querySelector('#file-url-status');
  const isAllowed = await isFileUrlAccessAllowed();

  card.dataset.state = isAllowed ? 'enabled' : 'disabled';
  status.textContent = isAllowed ? t('onboardingFileUrlEnabled') : t('onboardingFileUrlDisabled');
}

function setupFileUrlActions() {
  document.querySelector('#open-settings').addEventListener('click', () => openExtensionSettings());

  document.querySelector('#copy-settings-link').addEventListener('click', async () => {
    const status = document.querySelector('#file-url-status');
    try {
      const url = await copyExtensionSettingsUrl();
      status.textContent = t('statusCopied', [url]);
    } catch (error) {
      status.textContent = error?.message || String(error);
    }
  });
}

/* ---------- About ---------- */

function setupAbout() {
  const version = chrome.runtime.getManifest().version;
  document.querySelector('#about-version').textContent = t('aboutVersionLabel', [version]);
  document.querySelector('#open-viewer').addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('viewer/index.html') });
  });
}

/* ---------- Change log ---------- */

function changelogTypeLabel(type) {
  return t(CHANGELOG_TYPE_LABEL_KEYS[String(type || '').toLowerCase()] || 'changelogTypeChanged');
}

function changelogText(subject) {
  const text = String(subject || '')
    .split('\n')[0]
    .replace(/^[a-z][a-z0-9-]*(\([^)]+\))?!?:\s*/i, '')
    .trim();

  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function changelogCommitUrl(commit) {
  const hash = String(commit || '').trim();
  return hash ? `${CHANGELOG_REPO_URL}/commit/${encodeURIComponent(hash)}` : '';
}

function renderChangelogItem(item) {
  const text = changelogText(item?.subject);
  if (!text) return null;

  const url = changelogCommitUrl(item?.commit);
  const row = document.createElement(url ? 'a' : 'div');
  row.className = 'changelog-item';

  if (url) {
    row.href = url;
    row.target = '_blank';
    row.rel = 'noopener noreferrer';
  }

  const type = document.createElement('span');
  type.className = 'changelog-type';
  type.textContent = changelogTypeLabel(item?.type);
  row.append(type);

  const description = document.createElement('span');
  description.className = 'changelog-text';
  description.textContent = text;
  row.append(description);

  if (item?.commit) {
    const commit = document.createElement('span');
    commit.className = 'changelog-commit';
    commit.textContent = String(item.commit).slice(0, 7);
    row.append(commit);
  }

  return row;
}

function renderChangelogRelease(release) {
  const rows = (Array.isArray(release?.items) ? release.items : [])
    .map(item => renderChangelogItem(item))
    .filter(Boolean);
  if (!rows.length) return null;

  const section = document.createElement('section');
  section.className = 'changelog-release';

  const header = document.createElement('div');
  header.className = 'changelog-release-header';

  const version = document.createElement('h2');
  version.className = 'changelog-release-version';
  version.textContent = release?.version ? `v${release.version}` : t('navChangelog');
  header.append(version);

  if (release?.date) {
    const date = document.createElement('span');
    date.className = 'changelog-release-date';
    date.textContent = release.date;
    header.append(date);
  }

  const items = document.createElement('div');
  items.className = 'changelog-items';
  items.append(...rows);

  section.append(header, items);
  return section;
}

function renderChangelog(entries, failed = false) {
  const list = document.querySelector('#changelog-list');
  const empty = document.querySelector('#changelog-empty');
  if (!list || !empty) return;

  list.textContent = '';

  if (failed) {
    empty.textContent = t('changelogLoadFailed');
    empty.hidden = false;
    return;
  }

  const releases = (Array.isArray(entries) ? entries : [])
    .map(release => renderChangelogRelease(release))
    .filter(Boolean);

  if (!releases.length) {
    empty.textContent = t('changelogEmpty');
    empty.hidden = false;
    return;
  }

  list.append(...releases);
  empty.textContent = t('changelogEmpty');
  empty.hidden = true;
}

async function loadChangelog() {
  try {
    const response = await fetch(chrome.runtime.getURL(CHANGELOG_FILE));
    if (!response.ok) throw new Error('changelog-load-failed');
    renderChangelog(await response.json());
  } catch {
    renderChangelog([], true);
  }
}

/* ---------- init ---------- */

async function init() {
  syncChromeTheme();
  setupCategoryNav();
  setupAutoOpenControls();
  setupWebAccessToggle();
  setupFileUrlActions();
  setupAbout();
  loadChangelog();

  await loadConfig();
  buildTypeList();
  syncUI();
  refreshWebAccessToggle();

  refreshFileUrlStatus().catch(error => {
    document.querySelector('#file-url-status').textContent = error?.message || String(error);
  });
}

init();
