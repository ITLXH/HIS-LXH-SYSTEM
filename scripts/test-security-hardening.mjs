import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { escapeHisHtml } from '../shared/his-html.js';

assert.equal(
  escapeHisHtml(`<img src=x onerror="alert('x')"> & ຄົນເຈັບ`),
  '&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt; &amp; ຄົນເຈັບ'
);
assert.equal(escapeHisHtml(null), '');

const mainSource = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
assert.match(mainSource, /data-pid="\$\{escapeHisHtml\(r\.patientId\)\}"/);
assert.match(mainSource, /window\.triggerOpdQueuePublicCall\(\$\{i\}\)/);
assert.doesNotMatch(mainSource, /window\.triggerPublicCall\('\$\{r\.visitId\}'/);
assert.doesNotMatch(mainSource, /window\.deleteVisitFlow\('\$\{r\.visitId\}'/);

const opdViewSource = mainSource.slice(
  mainSource.indexOf('window.viewEMR = function'),
  mainSource.indexOf('window.handleSiteChange = function')
);
assert.match(opdViewSource, /const text = \(value, fallback = '—'\)/);
assert.match(opdViewSource, /return escapeHisHtml\(normalized \|\| fallback\)/);
assert.match(opdViewSource, /class="opd-view-record"/);
assert.doesNotMatch(opdViewSource, /\$\{q\.patientName\}/);
assert.doesNotMatch(opdViewSource, /onerror=/i);

const cutoverSql = await readFile(
  new URL('../docs/sql/finalize_auth_rls_and_audit.review.sql', import.meta.url),
  'utf8'
);
assert.match(cutoverSql, /REVOKE ALL ON TABLE .* FROM anon/);
assert.match(cutoverSql, /REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon/);
assert.match(cutoverSql, /GRANT SELECT, INSERT ON TABLE public\."HIS_One_OPD_Encounter_Revisions"/);
assert.doesNotMatch(cutoverSql, /GRANT[^;]*(UPDATE|DELETE)[^;]*HIS_One_OPD_Encounter_Revisions/i);

console.log('Security hardening checks passed');
