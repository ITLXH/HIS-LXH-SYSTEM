import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const main = readFileSync('src/main.js', 'utf8');
const master = readFileSync('public/partials/views/settings.html', 'utf8');
const editor = readFileSync('public/partials/views/investigation_templates.html', 'utf8');
const hub = readFileSync('public/partials/views/settings_hub.html', 'utf8');

assert.doesNotMatch(master, /investigationTemplateEditor|settings-template-section/);
assert.match(editor, /id="view-investigation_templates"/);
assert.match(editor, /id="investigationTemplateEditor"/);
assert.match(hub, /data-settings-view="investigation_templates"/);
assert.match(main, /'\/settings\/investigation-templates': 'investigation_templates'/);
assert.match(main, /investigation_templates: 'settings'/);
assert.match(main, /if \(v === 'investigation_templates'\) window\.renderInvestigationTemplateEditor\?\.\(\)/);
assert.doesNotMatch(main.match(/window\.renderMasterCategoryUI = function \(\) \{[\s\S]*?const groupHost/)?.[0] || '', /renderInvestigationTemplateEditor/);

console.log('Investigation template settings route checks passed');
