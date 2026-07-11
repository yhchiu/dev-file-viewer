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
# are overwritten on each run. Can be run from anywhere; it works relative to
# its own location (the repository root).
#
# Usage: ./git-log-json.sh [new-version]
#
# With a version argument (e.g. ./git-log-json.sh 3.1.1), package.json,
# package-lock.json, and public/manifest.json are first updated to that
# version, so the regenerated changelog lists it as the pending release.

cd "$(dirname -- "$0")"

# Optional version bump before the changelog is regenerated. Chrome manifest
# versions are 2-4 dot-separated integers, so validate against that.
if [ "$#" -ge 1 ]; then
  new_version=$1
  if ! printf '%s\n' "$new_version" | grep -Eq '^[0-9]+(\.[0-9]+){1,3}$'; then
    echo "git-log-json.sh: invalid version '$new_version' (expected e.g. 3.1.1)" >&2
    exit 1
  fi

  node - "$new_version" <<'NODE'
const fs = require('fs');

const version = process.argv[2];

// Replace only the version value so hand-maintained files keep their
// formatting. The first "version" string field in package.json and
// manifest.json is the package/extension version ("manifest_version" and
// "minimum_chrome_version" do not match the quoted-key pattern).
function replaceVersion(fileName) {
  const text = fs.readFileSync(fileName, 'utf8');
  if (!/"version"\s*:\s*"/.test(text)) {
    throw new Error(`No version field found in ${fileName}`);
  }
  fs.writeFileSync(fileName, text.replace(/("version"\s*:\s*")[^"]*(")/, `$1${version}$2`));
  console.log(`${fileName}: version set to ${version}`);
}

replaceVersion('package.json');
replaceVersion('public/manifest.json');

// package-lock.json is machine-generated in npm's own 2-space format, which a
// parse/stringify round-trip preserves; both of its version fields (top level
// and packages[""]) need updating.
if (fs.existsSync('package-lock.json')) {
  const lock = JSON.parse(fs.readFileSync('package-lock.json', 'utf8'));
  lock.version = version;
  if (lock.packages && lock.packages['']) lock.packages[''].version = version;
  fs.writeFileSync('package-lock.json', `${JSON.stringify(lock, null, 2)}\n`);
  console.log(`package-lock.json: version set to ${version}`);
}
NODE
fi

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
