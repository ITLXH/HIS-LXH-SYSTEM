import fs from 'node:fs';
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  .replace('<script type="module" src="/src/main.js"></script>', '<script src="/scripts/fixtures/workflow-backend.js"></script>\n<script type="module" src="/src/main.js"></script>\n<script type="module" src="/scripts/fixtures/workflow-checks.js"></script>');
fs.writeFileSync(new URL('./fixtures/his-workflow.html', import.meta.url), html);
console.log('Generated local-only HIS workflow fixture. All data/API traffic is mocked.');
