import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const { PGlite } = createRequire(path.resolve(process.argv[2] || '../UXI-LXH-main','package.json'))('@electric-sql/pglite');
const sql = fs.readFileSync(new URL('../supabase/migrations/20261020181000_outlab_send_currency_compatibility.sql',import.meta.url),'utf8');
const db = new PGlite();
try {
  await db.exec(`CREATE ROLE anon;CREATE ROLE authenticated;
    CREATE TABLE public.lis_one_outlab_orders(id text PRIMARY KEY,send_price numeric,system_price numeric,note text);
    INSERT INTO public.lis_one_outlab_orders VALUES ('synthetic-old',150000.50,200000.25,'keep');
    ALTER TABLE public.lis_one_outlab_orders ENABLE ROW LEVEL SECURITY;
    CREATE POLICY fixture_staff ON public.lis_one_outlab_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);
    GRANT SELECT,INSERT ON public.lis_one_outlab_orders TO authenticated;`);
  const before = (await db.query('SELECT * FROM public.lis_one_outlab_orders')).rows[0];
  const policyBefore = (await db.query("SELECT policyname,qual,with_check FROM pg_policies WHERE tablename='lis_one_outlab_orders'")).rows;
  await db.exec(sql);
  assert.deepEqual((await db.query('SELECT id,send_price,system_price,note FROM public.lis_one_outlab_orders')).rows[0],before);
  assert.equal((await db.query('SELECT send_currency FROM public.lis_one_outlab_orders')).rows[0].send_currency,'LAK');
  assert.deepEqual((await db.query("SELECT policyname,qual,with_check FROM pg_policies WHERE tablename='lis_one_outlab_orders'")).rows,policyBefore);
  await db.exec('SET ROLE authenticated');
  await db.exec(`INSERT INTO public.lis_one_outlab_orders(id,send_currency,send_price) VALUES ('synthetic-thb','THB',10),('synthetic-usd','USD',20);
    INSERT INTO public.lis_one_outlab_orders(id,send_price) VALUES ('synthetic-legacy',30);`);
  assert.equal((await db.query("SELECT send_currency FROM public.lis_one_outlab_orders WHERE id='synthetic-legacy'")).rows[0].send_currency,'LAK');
  await db.exec('RESET ROLE');
  await db.exec(sql);
  assert.equal((await db.query('SELECT count(*)::int AS n FROM public.lis_one_outlab_orders')).rows[0].n,4);
  console.log('PASS Outlab currency: historical amounts/notes and RLS unchanged, LAK legacy default, explicit THB/USD preserved, rerun safe.');
} finally { await db.close(); }
