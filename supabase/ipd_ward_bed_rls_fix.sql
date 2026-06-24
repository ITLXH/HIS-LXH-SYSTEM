ALTER TABLE public."HIS_One_Admissions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."HIS_One_Wards" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."HIS_One_Rooms" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."HIS_One_Beds" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."HIS_One_Bed_Movements" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_all_Admissions" ON public."HIS_One_Admissions";
CREATE POLICY "anon_all_Admissions" ON public."HIS_One_Admissions" FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_Wards" ON public."HIS_One_Wards";
CREATE POLICY "anon_all_Wards" ON public."HIS_One_Wards" FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_Rooms" ON public."HIS_One_Rooms";
CREATE POLICY "anon_all_Rooms" ON public."HIS_One_Rooms" FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_Beds" ON public."HIS_One_Beds";
CREATE POLICY "anon_all_Beds" ON public."HIS_One_Beds" FOR ALL TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_all_Bed_Movements" ON public."HIS_One_Bed_Movements";
CREATE POLICY "anon_all_Bed_Movements" ON public."HIS_One_Bed_Movements" FOR ALL TO anon USING (true) WITH CHECK (true);

GRANT ALL ON TABLE public."HIS_One_Admissions" TO anon, authenticated;
GRANT ALL ON TABLE public."HIS_One_Wards" TO anon, authenticated;
GRANT ALL ON TABLE public."HIS_One_Rooms" TO anon, authenticated;
GRANT ALL ON TABLE public."HIS_One_Beds" TO anon, authenticated;
GRANT ALL ON TABLE public."HIS_One_Bed_Movements" TO anon, authenticated;
