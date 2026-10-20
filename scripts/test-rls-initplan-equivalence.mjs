import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { PGlite } = createRequire(path.resolve(process.argv[2] || '../UXI-LXH-main', 'package.json'))('@electric-sql/pglite');
const fixtures = JSON.parse(fs.readFileSync(new URL('./fixtures/rls-initplan-before-20261020.json', import.meta.url), 'utf8').replace(/^\uFEFF/, ''));
const migration = fs.readFileSync(new URL('../supabase/migrations/20261020180000_rls_auth_uid_initplan.sql', import.meta.url), 'utf8');
const quote = s => `"${s.replaceAll('"', '""')}"`;
const table = p => `${quote(p.schemaname)}.${quote(p.tablename)}`;
const uid1 = '00000000-0000-0000-0000-000000000001';
const uid2 = '00000000-0000-0000-0000-000000000002';
const db = new PGlite();
try {
  await db.exec(`CREATE ROLE authenticated; CREATE ROLE anon;
    CREATE SCHEMA auth; CREATE SCHEMA realtime; CREATE SCHEMA pmc;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('test.uid',true),'')::uuid$$;
    CREATE FUNCTION realtime.topic() RETURNS text LANGUAGE sql STABLE AS $$SELECT current_setting('test.topic',true)$$;
    CREATE FUNCTION public.uxi_staff_role() RETURNS text LANGUAGE sql STABLE AS $$SELECT current_setting('test.role',true)$$;
    CREATE FUNCTION public.pmc_actor_has_permission_v1(text) RETURNS boolean LANGUAGE sql STABLE AS $$SELECT current_setting('test.manage',true)='true'$$;
    CREATE TABLE public."HIS_One_Users"("Auth_User_ID" uuid,"Status" text);
    CREATE TABLE public."UXI_One_main_staff"(id uuid);
    CREATE TABLE realtime.messages(extension text);
    INSERT INTO public."HIS_One_Users" VALUES ('${uid1}','active'),('${uid2}','inactive');
    INSERT INTO public."UXI_One_main_staff" VALUES ('${uid1}'),('${uid2}');
    INSERT INTO realtime.messages VALUES ('presence'),('broadcast');`);
  for (const name of ['pmc_user_profiles','pmc_user_roles','pmc_user_departments','pmc_user_warehouses']) {
    await db.exec(`CREATE TABLE pmc.${name}(user_id uuid); INSERT INTO pmc.${name} VALUES ('${uid1}'),('${uid2}');`);
  }
  await db.exec(`GRANT USAGE ON SCHEMA public,auth,realtime,pmc TO authenticated,anon;
    GRANT SELECT,UPDATE ON public."HIS_One_Users" TO authenticated;
    GRANT SELECT ON public."UXI_One_main_staff" TO authenticated;
    GRANT SELECT,INSERT ON realtime.messages TO authenticated;
    GRANT SELECT ON ALL TABLES IN SCHEMA pmc TO authenticated;
    ALTER TABLE public."HIS_One_Users" ENABLE ROW LEVEL SECURITY;
    CREATE POLICY fixture_user_read ON public."HIS_One_Users" FOR SELECT TO authenticated USING (true);`);
  for (const p of fixtures) {
    await db.exec(`ALTER TABLE ${table(p)} ENABLE ROW LEVEL SECURITY;
      CREATE POLICY ${quote(p.policyname)} ON ${table(p)} FOR ${p.cmd} TO authenticated
      ${p.qual ? `USING (${p.qual})` : ''} ${p.with_check ? `WITH CHECK (${p.with_check})` : ''};`);
  }
  async function snapshot() {
    const results = [];
    for (const [uid, role, manage, topic] of [[uid1,'User','false','his:staff:presence'],[uid2,'User','false','his:staff:presence'],[uid1,'Admin','true','his:staff:presence'],[uid1,'User','false','other'],['','User','false','his:staff:presence']]) {
      await db.exec(`BEGIN;SET LOCAL ROLE authenticated;SET LOCAL test.uid='${uid}';SET LOCAL test.role='${role}';SET LOCAL test.manage='${manage}';SET LOCAL test.topic='${topic}';`);
      const result = {};
      for (const p of fixtures.filter(p => p.cmd === 'SELECT')) {
        result[p.policyname] = (await db.query(`SELECT * FROM ${table(p)} ORDER BY 1`)).rows;
      }
      result.updated = (await db.query(`UPDATE public."HIS_One_Users" SET "Status"="Status" RETURNING "Auth_User_ID"`)).rows;
      await db.exec('SAVEPOINT presence_insert');
      try { await db.query(`INSERT INTO realtime.messages VALUES ('presence') RETURNING *`); result.insert = true; }
      catch (error) { assert.equal(error.code, '42501'); result.insert = false; await db.exec('ROLLBACK TO SAVEPOINT presence_insert'); }
      results.push(result);
      await db.exec('ROLLBACK');
    }
    return results;
  }
  const before = await snapshot();
  await db.exec(migration);
  assert.deepEqual(await snapshot(), before, 'read/write results must remain identical for staff, inactive users, admins, missing identities and wrong topics');
  await db.exec('SET ROLE anon');
  await assert.rejects(db.query('SELECT * FROM public."HIS_One_Users"'), e => e.code === '42501');
  await db.exec('RESET ROLE');
  const policies = (await db.query(`SELECT qual,with_check FROM pg_policies WHERE policyname <> 'fixture_user_read'`)).rows;
  assert.equal(policies.length, 8);
  for (const p of policies) assert.match(`${p.qual} ${p.with_check}`, /SELECT auth\.uid\(\)/i);
  // A changed policy must make the repair fail before altering any other policy.
  await db.exec(`ALTER POLICY his_user_self_session_update ON public."HIS_One_Users" USING (false)`);
  await assert.rejects(db.exec(migration), /RLS_POLICY_DRIFT/);
  await db.exec('ROLLBACK');
  console.log('PASS eight RLS initplan policies: equivalent access across five actor/topic contexts, anonymous access denied, drift rejected.');
} finally { await db.close(); }
