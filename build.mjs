// Minimal build script (esbuild). Bundles the client to dist/client/app.js and
// the server to dist/server/index.js, then copies the static client assets
// (public/) into dist/client alongside the bundle.
import { build } from 'esbuild';
import { cpSync, mkdirSync, existsSync } from 'node:fs';

const alias = { '@shared': new URL('./src/shared', import.meta.url).pathname };

await build({
  entryPoints: ['src/client/app/main.ts'],
  outfile: 'dist/client/app.js',
  bundle: true,
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  minify: true,
  sourcemap: true,
  alias,
});

await build({
  entryPoints: ['src/server/index.ts'],
  outfile: 'dist/server/index.js',
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node22',
  minify: true,
  sourcemap: true,
  external: ['ws'],
  banner: { js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);" },
  alias,
});

if (!existsSync('dist/client')) mkdirSync('dist/client', { recursive: true });
cpSync('public', 'dist/client', { recursive: true });

console.log('Build complete: dist/client, dist/server');
