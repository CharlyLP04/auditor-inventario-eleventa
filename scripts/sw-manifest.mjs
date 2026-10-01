import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';

const list = directory => readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
  const path = resolve(directory, entry.name);
  return entry.isDirectory() ? list(path) : [path];
});

// Runs after every build so any host (local server, Vercel, vite preview) gets a versioned cache.
export function writeServiceWorker(outDir) {
  const worker = resolve(outDir, 'sw.js');
  const files = list(outDir).filter(file => file !== worker).sort();
  const hash = createHash('sha256');
  for (const file of files) { hash.update(relative(outDir, file)); hash.update(readFileSync(file)); }
  const urls = files.map(file => '/' + relative(outDir, file).split(sep).join('/'));
  const source = readFileSync(worker, 'utf8')
    .replace('__BUILD_ID__', hash.digest('hex').slice(0, 16))
    .replace('/*__PRECACHE__*/ []', JSON.stringify(urls));
  writeFileSync(worker, source);
}
