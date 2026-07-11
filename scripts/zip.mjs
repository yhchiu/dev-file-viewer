import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(path.join(root, 'public/manifest.json'), 'utf8'));
const out = path.join(root, `dev-file-viewer-v${manifest.version}-dist.zip`);
// Zip from inside dist so manifest.json sits at the zip root, as the
// Chrome Web Store requires.
const result = spawnSync('zip', ['-qr', out, '.'], {
  cwd: path.join(root, 'dist'),
  stdio: 'inherit'
});
if (result.status !== 0) process.exit(result.status || 1);
console.log(out);
