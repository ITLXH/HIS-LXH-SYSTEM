import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const config = await readFile(new URL('../vite.config.js', import.meta.url), 'utf8');
const refresh = await readFile(new URL('../src/versionRefresh.js', import.meta.url), 'utf8');
const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
const headers = await readFile(new URL('../public/_headers', import.meta.url), 'utf8');

assert.match(config, /CF_PAGES_COMMIT_SHA/);
assert.match(config, /fileName:\s*'version\.json'/);
assert.match(config, /__HIS_BUILD_ID__/);
assert.match(refresh, /fetch\(`\/version\.json\?t=\$\{Date\.now\(\)\}`/);
assert.match(refresh, /cache:\s*'no-store'/);
assert.match(refresh, /hasVisibleUnsavedWork\(document\)/);
assert.match(refresh, /window\.location\.reload\(\)/);
assert.match(refresh, /options\.forceReload === true/);
assert.match(refresh, /beforeReload\(latestVersion\)/);
assert.match(main, /startBuildVersionRefresh\(\{[\s\S]*forceReload:\s*true/);
assert.match(main, /beforeReload:\s*\(\) => window\.clearAuthSession\?\.\(\)/);
assert.match(main, /const PARTIAL_CACHE_BUST = HIS_BUILD_ID/);
assert.match(headers, /\/version\.json[\s\S]*Cache-Control:\s*no-store/);

console.log('Production build-version refresh checks passed.');
