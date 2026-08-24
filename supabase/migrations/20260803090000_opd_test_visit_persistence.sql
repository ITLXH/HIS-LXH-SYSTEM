-- Additive fields used by the OPD Test doctor encounter screen.
-- Existing Visits fields remain the compatibility source for the legacy OPD UI.

alter table public."HIS_One_Visits"
  add column if not exists "HPI" text,
  add column if not exists "Past_History" text,
  add column if not exists "Clinical_Note_JSON" text,
  add column if not exists "EMR_Revision" integer not null default 0,
  add column if not exists "Completed_At" timestamptz,
  add column if not exists "Completed_By" text,
  add column if not exists "Updated_At" timestamptz not null default now();

create index if not exists "idx_HIS_One_Visits_Completed_At"
  on public."HIS_One_Visits" ("Completed_At" desc)
  where "Completed_At" is not null;

comment on column public."HIS_One_Visits"."Clinical_Note_JSON" is
  'Versioned OPD doctor encounter payload; legacy display fields remain populated in parallel.';
