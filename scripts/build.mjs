import { cp, mkdir, rm } from 'node:fs/promises';
import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
await cp(path.join(root, 'public'), dist, { recursive: true });

const common = {
  bundle: true,
  minify: true,
  sourcemap: false,
  target: ['chrome111'],
  logLevel: 'info',
  legalComments: 'none'
};

await build({
  ...common,
  entryPoints: [path.join(root, 'src/viewer/app.js')],
  outdir: path.join(dist, 'viewer'),
  format: 'esm',
  // Code splitting so the dynamically imported mermaid bundle becomes a
  // separate chunk that is only fetched when a document has a diagram.
  splitting: true,
  chunkNames: 'chunks/[name]-[hash]'
});

await build({
  ...common,
  entryPoints: [path.join(root, 'src/popup/popup.js')],
  outfile: path.join(dist, 'popup/popup.js'),
  format: 'iife'
});

await build({
  ...common,
  entryPoints: [path.join(root, 'src/content/markdown-autoview.js')],
  outfile: path.join(dist, 'content/markdown-autoview.js'),
  format: 'iife'
});

await build({
  ...common,
  entryPoints: [path.join(root, 'src/background/service-worker.js')],
  outfile: path.join(dist, 'background/service-worker.js'),
  format: 'esm'
});

await build({
  ...common,
  entryPoints: [path.join(root, 'src/settings/settings.js')],
  outfile: path.join(dist, 'settings/settings.js'),
  format: 'iife'
});

console.log(`Built Chrome extension to ${dist}`);
