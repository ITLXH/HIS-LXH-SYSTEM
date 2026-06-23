-- Link OPD observations to physical beds (reuses HIS_One_Wards/Rooms/Beds with Ward_Type='OPD_Observation').
-- This keeps OPD-observation occupancy separate from IPD census in the application layer,
-- while sharing the same bed-board rendering code.

ALTER TABLE public.opd_observations
  ADD COLUMN IF NOT EXISTS ward_id TEXT,
  ADD COLUMN IF NOT EXISTS room_id TEXT,
  ADD COLUMN IF NOT EXISTS bed_id  TEXT;

CREATE INDEX IF NOT EXISTS idx_opd_observations_bed_id ON public.opd_observations(bed_id);

-- Convenience: an active-observation-by-bed view that the UI can query when rendering
-- the OPD observation bed board. (Optional; the app can also derive this client-side.)
CREATE OR REPLACE VIEW public.opd_active_observations_by_bed AS
SELECT
  bed_id,
  observation_id,
  hn,
  patient_id,
  doctor_id,
  diagnosis,
  start_datetime,
  duration_hours,
  status
FROM public.opd_observations
WHERE bed_id IS NOT NULL
  AND status IN ('WAITING','UNDER_OBSERVATION');

GRANT SELECT ON public.opd_active_observations_by_bed TO anon, authenticated;
