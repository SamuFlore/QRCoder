import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { access, cp, mkdir, readdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const src = path.join(root, 'src');
const dist = path.join(root, 'dist');
const names = ['popup', 'background', 'offscreen', 'result'];
const entryPoints = names.map(name => path.join(src, name + '.js'));
const requiredFiles = [...entryPoints, path.join(src, 'manifest.json')];
const missing = [];
for (const entry of requiredFiles) {
  try { await access(entry); } catch { missing.push(path.relative(root, entry)); }
}
if (missing.length) {
  console.error('构建失败：缺少必需文件：' + missing.join(', '));
  process.exitCode = 1;
} else {
  await rm(dist, { recursive: true, force: true });
  await mkdir(dist, { recursive: true });
  for (const name of await readdir(src)) {
    await cp(path.join(src, name), path.join(dist, name), {
      recursive: true,
      filter: source => !/\.(?:js|mjs|cjs|map)$/i.test(source),
    });
  }
  const require = createRequire(import.meta.url);
  const cli = require.resolve('esbuild/bin/esbuild');
  const result = spawnSync(process.execPath, [cli, ...entryPoints, '--bundle', '--platform=browser', '--format=iife', '--target=chrome109', '--outdir=' + dist], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exitCode = result.status || 1;
}
