import { execFileSync } from 'node:child_process';
import { defineConfig } from 'vite';

function resolveBuildId() {
  const cloudflareCommit = String(process.env.CF_PAGES_COMMIT_SHA || '').trim();
  if (cloudflareCommit) return cloudflareCommit.slice(0, 12);

  try {
    return execFileSync('git', ['rev-parse', '--short=12', 'HEAD'], { encoding: 'utf8' }).trim();
  } catch {
    return `local-${Date.now()}`;
  }
}

const buildId = resolveBuildId();

export default defineConfig({
  define: {
    __HIS_BUILD_ID__: JSON.stringify(buildId),
  },
  plugins: [{
    name: 'his-build-version',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'version.json',
        source: `${JSON.stringify({ version: buildId })}\n`,
      });
    },
  }],
});
