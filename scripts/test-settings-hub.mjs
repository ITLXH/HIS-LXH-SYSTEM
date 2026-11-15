import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const nav = readFileSync('public/partials/navbar.html', 'utf8');
const hub = readFileSync('public/partials/views/settings_hub.html', 'utf8');
const main = readFileSync('src/main.js', 'utf8');
assert.match(nav, /id="nav-settings_hub"/);
assert.doesNotMatch(nav, /his-settings-menu/);
assert.match(main, /settings_hub: \{ view: 'settings_hub'/);
assert.match(main, /'\/settings\/menu': 'settings_hub'/);
assert.match(main, /view === 'settings_hub'/);
assert.match(main, /\[data-settings-view\]/);
assert.match(hub, /data-settings-view="settings" data-master-group="pharmacy"/);
assert.match(hub, /<h2>ຈັດການແລັບ<\/h2>[\s\S]*?data-settings-view="labs"/);
assert.match(hub, /data-settings-view="settings" data-master-category="LabCategory"/);
assert.match(nav, /class="his-dropdown his-nav-deferred mnu-opd_observation"/);
assert.match(nav, /class="his-dropdown his-nav-deferred mnu-ipd_ward_bed/);
assert.match(nav, /class="his-nav-link his-nav-deferred" id="nav-vaccines"/);
assert.match(nav, /class="his-nav-link his-nav-deferred" id="nav-appointments"/);
for (const view of ['services', 'drugs', 'labs', 'vaccine_master', 'ipd_config', 'locations', 'orgs', 'staff', 'users', 'offline_sticker', 'printer_settings', 'settings', 'activity_log', 'backup']) {
  assert.equal((hub.match(new RegExp(`data-settings-view="${view}"`, 'g')) || []).length, view === 'settings' ? 3 : 1, view);
}
console.log('Settings hub navigation and permissions checks passed');
