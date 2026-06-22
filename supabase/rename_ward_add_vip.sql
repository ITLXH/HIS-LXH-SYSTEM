-- Rename "IPD Demo Ward" to "IPD Ward" and create a separate "IPD VIP Ward".
-- Run in Supabase SQL Editor.

-- 1. Rename existing ward
UPDATE public."HIS_One_Wards"
   SET "Ward_Name" = 'IPD Ward',
       "Ward_Type" = COALESCE("Ward_Type", 'General'),
       "Updated_At" = NOW()
 WHERE "Ward_Name" = 'IPD Demo Ward'
    OR "Ward_ID"   = 'WARD-DEMO-01';

-- 2. Create separate VIP ward
INSERT INTO public."HIS_One_Wards"
       ("Ward_ID",      "Ward_Name",     "Ward_Type", "Department",  "Floor", "Capacity", "Status", "Description")
VALUES ('WARD-VIP-01',  'IPD VIP Ward',  'VIP',       'IPD VIP',     '2',     0,          'Active', 'VIP rooms separated from general IPD ward')
ON CONFLICT ("Ward_ID") DO UPDATE
   SET "Ward_Name" = EXCLUDED."Ward_Name",
       "Ward_Type" = EXCLUDED."Ward_Type",
       "Updated_At" = NOW();

-- 3. Sanity check
SELECT "Ward_ID", "Ward_Name", "Ward_Type", "Floor", "Status"
  FROM public."HIS_One_Wards"
 ORDER BY "Ward_Type", "Ward_Name";
