#!/bin/sh
set -eu

# Regenerates CHANGELOG.json from git history.
#
# Commits are grouped the way a changelog usually reads: a version bump opens a
# release, and every commit after it -- up to and including the next bump --
# belongs to that release. Because each bump is committed together with its
# feature, the bump commit ships its own new version, while the follow-up
# commits roll forward into the next release. Commits made since the last
# committed bump roll into the working-tree (pending) version, which sits on top.
#
# The output is fully derived from git, so any manual edits to CHANGELOG.json
# are overwritten on each run. Run from the directory that holds manifest.json
# and CHANGELOG.json (public/).

cd public

tmp_dir=$(mktemp -d "${TMPDIR:-/tmp}/dev-file-viewer-changelog.XXXXXX")
trap 'rm -rf "$tmp_dir"' EXIT HUP INT TERM

git_log_file="$tmp_dir/git-log.txt"
commit_versions_file="$tmp_dir/commit-versions.txt"

# Full commit list, newest first: <hash>\x1f<subject>\x1f<date>
git log --no-merges --format='%H%x1f%s%x1f%ad' --date=short > "$git_log_file"

# Version recorded in manifest.json at each commit that touched it (the only
# commits where the version can change). Output: <hash>\x1f<version>
: > "$commit_versions_file"
for commit in $(git log --no-merges --format='%H' -- manifest.json); do
  version=$(git show "$commit:./manifest.json" 2>/dev/null \
    | sed -n 's/.*"version"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' \
    | head -n1)
  printf '%s\x1f%s\n' "$commit" "$version" >> "$commit_versions_file"
done

node - "$git_log_file" "$commit_versions_file" <<'NODE'
const fs = require('fs');

const CHANGELOG_FILE = 'CHANGELOG.json';
const MANIFEST_FILE = 'manifest.json';
const gitLogFile = process.argv[2];
const commitVersionsFile = process.argv[3];

function readJsonFile(fileName, fallback) {
  try {
    return JSON.parse(fs.readFileSync(fileName, 'utf8'));
  } catch (_) {
    return fallback;
  }
}

function commitType(subject) {
  const match = String(subject || '').match(/^([a-z][a-z0-9-]*)(\([^)]+\))?!?:/i);
  return match ? match[1].toLowerCase() : 'other';
}

function isReleaseNoise(subject) {
  return /^chore: update version to /.test(subject) || subject === 'chore: initial commit';
}

// commit -> version, for the commits that touched manifest.json
const commitVersion = new Map();
fs.readFileSync(commitVersionsFile, 'utf8')
  .split('\n')
  .filter(Boolean)
  .forEach((line) => {
    const [commit, version] = line.split('\x1f');
    if (commit && version) commitVersion.set(commit, version);
  });

// Full log, newest first.
const logText = fs.readFileSync(gitLogFile, 'utf8').trim();
const commits = logText
  ? logText.split('\n').map((line) => {
      const [commit, subject, date] = line.split('\x1f');
      return { commit, subject, date };
    })
  : [];

// Forward-fill the effective manifest version (oldest -> newest) and flag the
// bump commits -- the ones where the version actually changes.
let version;
[...commits].reverse().forEach((item) => {
  const recorded = commitVersion.get(item.commit);
  item.isBump = recorded !== undefined && recorded !== version;
  if (item.isBump) version = recorded;
  item.version = version;
});

const manifest = readJsonFile(MANIFEST_FILE, {});
const pendingVersion = manifest.version;
if (!pendingVersion) {
  throw new Error(`Cannot read version from ${MANIFEST_FILE}`);
}

// Assign each commit to a release (newest -> oldest). A bump commit ships its
// own new version; every commit after a bump rolls forward into the upcoming
// release -- the working-tree version for the most recent stretch.
let upcoming = pendingVersion;
commits.forEach((item) => {
  if (item.isBump) {
    item.release = item.version;
    upcoming = item.version;
  } else {
    item.release = upcoming;
  }
});

// Group into releases, newest first, dropping release-noise commits.
const releaseByVersion = new Map();
const order = [];
commits.forEach((item) => {
  if (!item.commit || !item.subject || !item.release) return;
  if (isReleaseNoise(item.subject)) return;
  if (!releaseByVersion.has(item.release)) {
    releaseByVersion.set(item.release, { version: item.release, date: item.date, items: [] });
    order.push(item.release);
  }
  releaseByVersion.get(item.release).items.push({
    commit: item.commit,
    type: commitType(item.subject),
    subject: item.subject,
  });
});

let releases = order.map((v) => releaseByVersion.get(v)).filter((release) => release.items.length);

// Surface the pending release on top even if nothing has landed in it yet.
if (!releases.some((release) => release.version === pendingVersion)) {
  releases = [
    { version: pendingVersion, date: new Date().toISOString().slice(0, 10), items: [] },
    ...releases,
  ];
}

fs.writeFileSync(CHANGELOG_FILE, `${JSON.stringify(releases, null, 2)}\n`);
NODE
