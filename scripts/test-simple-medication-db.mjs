import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFile} from 'node:fs/promises';
const require=createRequire(process.env.PMC_TEST_PACKAGE || import.meta.url);
const {PGlite}=require('@electric-sql/pglite');
const db=new PGlite();
try {
await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT '10000000-0000-4000-8000-000000000001'::uuid $$;
CREATE FUNCTION auth.role() RETURNS text LANGUAGE sql AS $$ SELECT current_user::text $$;
GRANT USAGE ON SCHEMA auth TO authenticated,anon;
CREATE FUNCTION public.his_one_is_active_user() RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
CREATE FUNCTION public.his_one_current_role() RETURNS text LANGUAGE sql AS $$ SELECT 'doctor'::text $$;
CREATE FUNCTION public.his_one_has_action(text,text) RETURNS boolean LANGUAGE sql AS $$ SELECT true $$;
CREATE TABLE public."HIS_One_Drugs_Master"("Drug_ID" text,"Drug_Name" text,"Description" text);
CREATE TABLE public."HIS_One_Visits"("Patient_ID" text,"Visit_ID" text,"EMR_Revision" integer,"Prescription_JSON" text);
ALTER TABLE public."HIS_One_Visits" ENABLE ROW LEVEL SECURITY;
CREATE POLICY staff ON public."HIS_One_Visits" TO authenticated USING("Patient_ID"='SYN-P') WITH CHECK("Patient_ID"='SYN-P');
GRANT SELECT,UPDATE ON public."HIS_One_Visits" TO authenticated;
GRANT SELECT ON public."HIS_One_Drugs_Master" TO authenticated;
INSERT INTO public."HIS_One_Drugs_Master" VALUES('SYN-D','Synthetic','TAB');
INSERT INTO public."HIS_One_Visits" VALUES('SYN-P','SYN-V',0,'[]'),('OTHER','OTHER',0,'[]');`);
await db.exec(await readFile('supabase/migrations/20261027060000_native_physician_submission.sql','utf8'));
await db.exec(`CREATE TABLE pmc.his_pmc_catalogue_settings(singleton boolean,enabled boolean,version text,synced_at timestamptz);
CREATE TABLE pmc.his_pmc_medicines(id uuid,name_lo text,is_active boolean,unit_code text);
GRANT SELECT ON pmc.his_pmc_catalogue_settings,pmc.his_pmc_medicines TO authenticated;
UPDATE pmc.his_native_submission_settings SET enabled=true;`);
await db.exec(await readFile('supabase/migrations/20261105010000_simple_medication_submission.sql','utf8'));
const line={prescriptionItemId:'SYN-L',sourceDrugId:'SYN-D',name:'Synthetic',quantity:'0.5',unitCode:'TAB',instructions:'Synthetic original directions',dose:'',route:'',frequency:'',duration:''};
async function send(lines=[line],revision=0,patient='SYN-P',visit='SYN-V',role='authenticated'){
 await db.exec(`BEGIN; SET LOCAL ROLE ${role}`);
 try {const r=await db.query('SELECT public.pmc_submit_native_batch_v2($1,$2,$3,$4,$5) result',[patient,visit,revision,'SYN-B',JSON.stringify(lines)]);await db.exec('COMMIT');return r.rows[0].result;}
 catch(e){await db.exec('ROLLBACK');throw e;}
}
await assert.rejects(send([{...line,unitCode:'BOX'}]),/CATALOG_REQUIRED/);
await assert.rejects(send([{...line,instructions:''}]),/INVALID_LINE/);
await assert.rejects(send([{...line,quantity:'0'}]),/INVALID_LINE/);
await assert.rejects(send([{...line,dose:'1'}]),/INVALID_LINE/);
await assert.rejects(send([line],0,'OTHER','OTHER'),/VISIT_NOT_FOUND/);
await assert.rejects(send([line],0,'SYN-P','SYN-V','anon'),/permission denied/);
assert.equal((await send()).revision,1);
assert.equal((await send()).replayed,true);
await assert.rejects(send([{...line,instructions:'changed'}],1),/SENT_BATCH_CHANGED/);
const stored=JSON.parse((await db.query('SELECT "Prescription_JSON" data FROM public."HIS_One_Visits" WHERE "Patient_ID"=\'SYN-P\'')).rows[0].data);
assert.equal(stored.length,1);assert.equal(stored[0].instructions,line.instructions);assert.equal(stored[0].unitCode,'TAB');assert.equal(stored[0].dose,'');
console.log('PASS atomic simple submission, unit mismatch, validation, RLS, anon denial and idempotent retry');
} finally {await db.close();}
