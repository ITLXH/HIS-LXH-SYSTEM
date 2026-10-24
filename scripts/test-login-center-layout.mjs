import assert from 'node:assert/strict';
import fs from 'node:fs';

// Contract regression for jQuery .show() on #login-section: inline display:block
// must be restored to flex only when the login screen is actually visible.
const css = fs.readFileSync(new URL('../src/style.css', import.meta.url), 'utf8');
const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const main = fs.readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');

assert.match(html, /class="login-page" id="login-section"/, 'HIS login should use the known login-page host');
assert.match(css, /\.login-page\s*\{[^}]*\bdisplay:\s*flex\s*;/, 'Login base layout must be flex');
assert.match(css, /\.login-page\s*\{[^}]*\bjustify-content:\s*center\s*;/, 'Login content must be horizontally centered');
assert.match(css, /\.login-page\s*\{[^}]*\balign-items:\s*center\s*;/, 'Login content must be vertically centered');
assert.match(css, /\.login-page\s*\{[^}]*\bmargin-top:\s*0\s*;/, 'Login centering must not be shifted by a navbar margin');
assert.match(css, /body:not\(\.auth-checking\) #login-section\.login-page\[style\*="display: block"\][\s\S]{0,230}display:\s*flex\s*!important/, 'jQuery inline display:block needs a scoped flex override');
assert.match(css, /body\.auth-checking #login-section,\s*body\.auth-checking #app-content\s*\{\s*display:\s*none\s*!important;/, 'Auth-checking must continue to hide login and app content');
assert.match(main, /\$\('#login-section'\)\.show\(\)/, 'HIS login still uses jQuery show flow');
assert.match(main, /\$\('#login-section'\)\.hide\(\)/, 'Authenticated HIS must still hide login');
assert.doesNotMatch(css, /#login-section\.login-page\s*\{\s*display:\s*flex\s*!important/, 'Never force the hidden login screen visible');

console.log('HIS login layout CSS contract passed: centered while displayed, hidden during auth-checking.');
