-- Extend the shared Triage/Dashboard Department service master list.
-- The unique Category/Value index keeps this migration safe to re-run.

INSERT INTO public."HIS_One_MasterData" ("Category", "Value")
VALUES
  ('ServiceDepartment', 'First Aid Training'),
  ('ServiceDepartment', 'Home Care')
ON CONFLICT ("Category", "Value") DO NOTHING;
