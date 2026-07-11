import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(await readFile(path.join(root, 'public/manifest.json'), 'utf8'));
const out = path.join(root, `dev-file-viewer-v${manifest.version}-dist.zip`);
const result = spawnSync('zip', ['-qr', out, 'dist'], { cwd: root, stdio: 'inherit' });
if (result.status !== 0) process.exit(result.status || 1);
console.log(out);
