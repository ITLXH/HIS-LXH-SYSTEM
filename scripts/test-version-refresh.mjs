import assert from 'node:assert/strict';
import fs from 'node:fs';
const config=fs.readFileSync(new URL('../vite.config.js',import.meta.url),'utf8');
const main=fs.readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
const sw=fs.readFileSync(new URL('../public/his-offline-sw.js',import.meta.url),'utf8');
assert.match(config,/fileName:\s*'version\.json'/);assert.match(main,/beforeReload:.*clearAuthSession/);
assert.doesNotMatch(main,/forceReload:\s*true/);assert.match(sw,/pathname === '\/version\.json'\) return/);
await import('./test-release-safety.mjs');
console.log('HIS manifest/session integration and safe-release behavior passed.');
