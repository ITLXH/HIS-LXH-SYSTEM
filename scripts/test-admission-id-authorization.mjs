import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const {PGlite}=createRequire(path.resolve(process.argv[2] || '../UXI-LXH-main','package.json'))('@electric-sql/pglite');
const before=JSON.parse(fs.readFileSync(new URL('./fixtures/admission-id-before-20261020.json',import.meta.url),'utf8').replace(/^\uFEFF/,''));
const migration=process.argv.includes('--baseline') ? '' : fs.readFileSync(new URL('../supabase/migrations/20261020182000_admission_id_authorization.sql',import.meta.url),'utf8');
const db=new PGlite();
try{
 await db.exec(`CREATE ROLE authenticated;CREATE ROLE anon;
 CREATE FUNCTION public.his_one_is_active_user() RETURNS boolean LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('test.active',true),'')::boolean$$;
 CREATE FUNCTION public.his_one_can_table_write(text,text) RETURNS boolean LANGUAGE sql STABLE AS $$SELECT nullif(current_setting('test.admit',true),'')::boolean$$;
 CREATE TABLE public."HIS_One_Admissions"("Admission_ID" text,"Admission_Date" text);
 CREATE TABLE public."HIS_One_AM_Counters"("Admission_Date" text PRIMARY KEY,"Last_Seq" integer,"Updated_At" timestamptz);
 INSERT INTO public."HIS_One_Admissions" VALUES ('AM20261020-003','2026-10-20');`);
 await db.exec(before.definition);
 await db.exec(`REVOKE ALL ON FUNCTION public.his_one_generate_am_id(text) FROM PUBLIC,anon;GRANT EXECUTE ON FUNCTION public.his_one_generate_am_id(text) TO authenticated;`);
 if(migration) await db.exec(migration);
 for(const [active,admit] of [['false','true'],['true','false'],['','']]){
  await db.exec(`SET ROLE authenticated;SET test.active='${active}';SET test.admit='${admit}'`);
  await assert.rejects(db.query("SELECT public.his_one_generate_am_id('2026-10-20')"),e=>e.code==='42501');
  await db.exec('RESET ROLE');
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public."HIS_One_AM_Counters"')).rows[0].n,0);
 }
 await db.exec("SET ROLE authenticated;SET test.active='true';SET test.admit='true'");
 assert.equal((await db.query("SELECT public.his_one_generate_am_id('2026-10-20') AS id")).rows[0].id,'AM20261020-004');
 assert.equal((await db.query("SELECT public.his_one_generate_am_id('2026-10-20') AS id")).rows[0].id,'AM20261020-005');
 await db.exec('RESET ROLE;SET ROLE anon');
 await assert.rejects(db.query("SELECT public.his_one_generate_am_id('2026-10-20')"),e=>e.code==='42501');
 console.log('PASS admission IDs: inactive, read-only, missing-state and anonymous callers denied without counter changes; authorized monotonic allocation preserved.');
}finally{await db.close();}
