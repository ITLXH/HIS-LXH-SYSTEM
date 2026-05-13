DROP VIEW IF EXISTS public."Patients" CASCADE;
CREATE VIEW public."Patients" AS SELECT * FROM public."HIS_One_Patients";
GRANT ALL ON public."Patients" TO anon, authenticated;

DROP VIEW IF EXISTS public."Visits" CASCADE;
CREATE VIEW public."Visits" AS SELECT * FROM public."HIS_One_Visits";
GRANT ALL ON public."Visits" TO anon, authenticated;

DROP VIEW IF EXISTS public."Appointments" CASCADE;
CREATE VIEW public."Appointments" AS SELECT * FROM public."HIS_One_Appointments";
GRANT ALL ON public."Appointments" TO anon, authenticated;

DROP VIEW IF EXISTS public."Organizations" CASCADE;
CREATE VIEW public."Organizations" AS SELECT * FROM public."HIS_One_Organizations";
GRANT ALL ON public."Organizations" TO anon, authenticated;

DROP VIEW IF EXISTS public."Service_Lists" CASCADE;
CREATE VIEW public."Service_Lists" AS SELECT * FROM public."HIS_One_Service_Lists";
GRANT ALL ON public."Service_Lists" TO anon, authenticated;

DROP VIEW IF EXISTS public."MasterData" CASCADE;
CREATE VIEW public."MasterData" AS SELECT * FROM public."HIS_One_MasterData";
GRANT ALL ON public."MasterData" TO anon, authenticated;

DROP VIEW IF EXISTS public."Locations" CASCADE;
CREATE VIEW public."Locations" AS SELECT * FROM public."HIS_One_Locations";
GRANT ALL ON public."Locations" TO anon, authenticated;

DROP VIEW IF EXISTS public."Drugs_Master" CASCADE;
CREATE VIEW public."Drugs_Master" AS SELECT * FROM public."HIS_One_Drugs_Master";
GRANT ALL ON public."Drugs_Master" TO anon, authenticated;

DROP VIEW IF EXISTS public."Labs_Master" CASCADE;
CREATE VIEW public."Labs_Master" AS SELECT * FROM public."HIS_One_Labs_Master";
GRANT ALL ON public."Labs_Master" TO anon, authenticated;

DROP VIEW IF EXISTS public."Vaccines_Master" CASCADE;
CREATE VIEW public."Vaccines_Master" AS SELECT * FROM public."HIS_One_Vaccines_Master";
GRANT ALL ON public."Vaccines_Master" TO anon, authenticated;

DROP VIEW IF EXISTS public."Patient_Vaccines" CASCADE;
CREATE VIEW public."Patient_Vaccines" AS SELECT * FROM public."HIS_One_Patient_Vaccines";
GRANT ALL ON public."Patient_Vaccines" TO anon, authenticated;

DROP VIEW IF EXISTS public."Users" CASCADE;
CREATE VIEW public."Users" AS SELECT * FROM public."HIS_One_Users";
GRANT ALL ON public."Users" TO anon, authenticated;

DROP VIEW IF EXISTS public."Settings" CASCADE;
CREATE VIEW public."Settings" AS SELECT * FROM public."HIS_One_Settings";
GRANT ALL ON public."Settings" TO anon, authenticated;

DROP VIEW IF EXISTS public."activity_logs" CASCADE;
CREATE VIEW public."activity_logs" AS SELECT * FROM public."HIS_One_activity_logs";
GRANT ALL ON public."activity_logs" TO anon, authenticated;

DROP VIEW IF EXISTS public."Admissions" CASCADE;
CREATE VIEW public."Admissions" AS SELECT * FROM public."HIS_One_Admissions";
GRANT ALL ON public."Admissions" TO anon, authenticated;

DROP VIEW IF EXISTS public."Wards" CASCADE;
CREATE VIEW public."Wards" AS SELECT * FROM public."HIS_One_Wards";
GRANT ALL ON public."Wards" TO anon, authenticated;

DROP VIEW IF EXISTS public."Rooms" CASCADE;
CREATE VIEW public."Rooms" AS SELECT * FROM public."HIS_One_Rooms";
GRANT ALL ON public."Rooms" TO anon, authenticated;

DROP VIEW IF EXISTS public."Beds" CASCADE;
CREATE VIEW public."Beds" AS SELECT * FROM public."HIS_One_Beds";
GRANT ALL ON public."Beds" TO anon, authenticated;

DROP VIEW IF EXISTS public."Progress_Notes" CASCADE;
CREATE VIEW public."Progress_Notes" AS SELECT * FROM public."HIS_One_Progress_Notes";
GRANT ALL ON public."Progress_Notes" TO anon, authenticated;

DROP VIEW IF EXISTS public."IPD_Medications" CASCADE;
CREATE VIEW public."IPD_Medications" AS SELECT * FROM public."HIS_One_IPD_Medications";
GRANT ALL ON public."IPD_Medications" TO anon, authenticated;

DROP VIEW IF EXISTS public."IPD_Vital_Signs" CASCADE;
CREATE VIEW public."IPD_Vital_Signs" AS SELECT * FROM public."HIS_One_IPD_Vital_Signs";
GRANT ALL ON public."IPD_Vital_Signs" TO anon, authenticated;

DROP VIEW IF EXISTS public."Nursing_Notes" CASCADE;
CREATE VIEW public."Nursing_Notes" AS SELECT * FROM public."HIS_One_Nursing_Notes";
GRANT ALL ON public."Nursing_Notes" TO anon, authenticated;

DROP VIEW IF EXISTS public."IPD_Visits" CASCADE;
CREATE VIEW public."IPD_Visits" AS SELECT * FROM public."HIS_One_IPD_Visits";
GRANT ALL ON public."IPD_Visits" TO anon, authenticated;

NOTIFY pgrst, 'reload schema';