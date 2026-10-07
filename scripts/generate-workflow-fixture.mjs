import fs from 'node:fs';
const pages = process.argv.includes('--pages');
const registry = process.argv.includes('--registry');
const controller = registry ? 'registry-search-checks' : pages ? 'page-audit-checks' : 'workflow-checks';
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  .replace('<script type="module" src="/src/main.js"></script>', `<script src="/scripts/fixtures/workflow-backend.js"></script>\n<script type="module" src="/src/main.js"></script>\n<script type="module" src="/scripts/fixtures/${controller}.js"></script>`);
fs.writeFileSync(new URL(`./fixtures/his-${registry ? 'registry-search' : pages ? 'page-audit' : 'workflow'}.html`, import.meta.url), html);
console.log('Generated local-only HIS workflow fixture. All data/API traffic is mocked.');
