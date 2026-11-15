import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync('src/style.css', 'utf8');
const nav = readFileSync('public/partials/navbar.html', 'utf8');
assert.match(nav, /class="his-topnav"/);
assert.match(css, /--nav-height:\s*60px/);
assert.match(css, /\.his-topnav \.his-nav-link\s*\{[^}]*font-size:\s*14px !important/s);
assert.match(css, /@media \(max-width: 1500px\)\s*\{\s*\.his-hamburger/s);
console.log('Navbar scale checks passed');
