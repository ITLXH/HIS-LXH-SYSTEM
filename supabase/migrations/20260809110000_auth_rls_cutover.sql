-- DEPLOYMENT GATE: apply this migration only AFTER the Supabase Auth frontend
-- and Cloudflare Functions are deployed and Doctor/Nurse/Admin UAT passes.
-- It removes anonymous table access and makes database permissions authoritative.

CREATE OR REPLACE FUNCTION public.his_one_has_page_permission(permission_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN lower(COALESCE((public.his_one_current_profile())."Role", '')) = 'admin' THEN true
    ELSE lower(COALESCE((public.his_one_current_profile())."Permissions", ''))
      ~ ('(^|,)\s*' || lower(regexp_replace(permission_name, '([^a-zA-Z0-9_])', '', 'g')) || '\s*(,|$)')
  END
$$;

CREATE OR REPLACE FUNCTION public.his_one_has_action(module_name text, action_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN lower(COALESCE((public.his_one_current_profile())."Role", '')) = 'admin' THEN true
    ELSE COALESCE(
      ((public.his_one_current_profile())."ButtonPermissions"::jsonb -> lower(module_name) ->> lower(action_name)) = 'true',
      false
    )
  END
$$;

CREATE OR REPLACE FUNCTION public.his_one_can_table_write(table_name text, operation_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.his_one_is_admin() OR CASE table_name
    WHEN 'HIS_One_Patients' THEN CASE WHEN operation_name = 'insert'
      THEN public.his_one_has_action('patients', 'add')
      ELSE public.his_one_has_action('patients', 'edit') END
    WHEN 'HIS_One_Visits' THEN CASE WHEN operation_name = 'insert'
      THEN public.his_one_has_action('patients', 'triage') OR public.his_one_has_action('opd', 'edit')
      ELSE public.his_one_has_action('triage', 'edit') OR public.his_one_has_action('opd', 'edit') END
    WHEN 'HIS_One_OPD_Vital_Signs' THEN public.his_one_has_action('triage', 'edit')
    WHEN 'HIS_One_Appointments' THEN public.his_one_has_action('appointments', CASE WHEN operation_name = 'insert' THEN 'add' ELSE 'edit' END)
    WHEN 'HIS_One_Patient_Vaccines' THEN public.his_one_has_page_permission('vaccines')
    WHEN 'opd_observations' THEN CASE WHEN operation_name = 'insert'
      THEN public.his_one_has_action('opd_observation', 'add')
      ELSE public.his_one_has_action('opd_observation', 'note')
        OR public.his_one_has_action('opd_observation', 'convert')
        OR public.his_one_has_action('opd_observation', 'discharge') END
    WHEN 'opd_observation_notes' THEN public.his_one_has_action('opd_observation', 'note')
    WHEN 'HIS_One_Admissions' THEN CASE WHEN operation_name = 'insert'
      THEN public.his_one_has_action('ipd', 'admit')
      ELSE public.his_one_has_action('ipd', 'transfer')
        OR public.his_one_has_action('ipd', 'discharge')
        OR public.his_one_has_action('ipd', 'chart_edit') END
    WHEN 'HIS_One_Bed_Movements' THEN public.his_one_has_action('ipd', 'transfer')
    WHEN 'HIS_One_AM_Counters' THEN public.his_one_has_action('patients', 'triage') OR public.his_one_has_action('ipd', 'admit')
    WHEN 'HIS_One_IPD_Billing_Items' THEN public.his_one_current_role() = 'cashier'
    WHEN 'HIS_One_OPD_Encounter_Revisions' THEN public.his_one_has_action('opd', 'edit')
    WHEN 'HIS_One_Result_Acknowledgments' THEN public.his_one_has_action('labs', 'view')
    ELSE public.his_one_has_action('ipd', CASE
      WHEN table_name = 'HIS_One_IPD_Discharge_Summaries' THEN 'discharge'
      ELSE 'chart_edit'
    END)
  END
$$;

REVOKE ALL ON FUNCTION public.his_one_has_page_permission(text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.his_one_has_action(text, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.his_one_can_table_write(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.his_one_has_page_permission(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.his_one_has_action(text, text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.his_one_can_table_write(text, text) TO authenticated, service_role;

DO $$
DECLARE
  t record;
  p record;
BEGIN
  FOR t IN
    SELECT schemaname, tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND (tablename LIKE 'HIS_One_%' OR tablename IN ('opd_observations', 'opd_observation_notes'))
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY', t.schemaname, t.tablename);
    EXECUTE format('REVOKE ALL ON TABLE %I.%I FROM anon', t.schemaname, t.tablename);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I.%I TO authenticated', t.schemaname, t.tablename);

    FOR p IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = t.schemaname AND tablename = t.tablename
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', p.policyname, t.schemaname, t.tablename);
    END LOOP;

    EXECUTE format(
      'CREATE POLICY his_admin_all ON %I.%I FOR ALL TO authenticated USING (public.his_one_is_admin()) WITH CHECK (public.his_one_is_admin())',
      t.schemaname, t.tablename
    );
  END LOOP;
END
$$;

-- Users are readable only as safe profile columns. Password_Hash is never
-- available to the browser, including to an administrator.
REVOKE ALL ON TABLE public."HIS_One_Users" FROM authenticated;
GRANT SELECT ("ID", "Auth_User_ID", "Name", "Email", "Role", "Permissions", "ButtonPermissions", "Status", "Must_Change_Password", "Last_Login_At", "Updated_At")
  ON public."HIS_One_Users" TO authenticated;
GRANT UPDATE ("Must_Change_Password", "Last_Login_At") ON public."HIS_One_Users" TO authenticated;

CREATE POLICY his_staff_profile_read ON public."HIS_One_Users"
  FOR SELECT TO authenticated
  USING (public.his_one_is_active_user());
CREATE POLICY his_user_self_session_update ON public."HIS_One_Users"
  FOR UPDATE TO authenticated
  USING ("Auth_User_ID" = auth.uid())
  WITH CHECK ("Auth_User_ID" = auth.uid());

-- Every active clinical user may read shared clinical/reference records.
DO $$
DECLARE
  table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'HIS_One_Patients', 'HIS_One_Visits', 'HIS_One_OPD_Vital_Signs',
    'HIS_One_Appointments', 'HIS_One_Patient_Vaccines',
    'HIS_One_Organizations', 'HIS_One_Vaccines_Master', 'HIS_One_Drugs_Master',
    'HIS_One_Labs_Master', 'HIS_One_Service_Lists', 'HIS_One_Locations',
    'HIS_One_MasterData', 'HIS_One_Settings',
    'HIS_One_Admissions', 'HIS_One_Wards', 'HIS_One_Rooms', 'HIS_One_Beds',
    'HIS_One_Bed_Movements', 'HIS_One_IPD_Doctor_Notes',
    'HIS_One_IPD_Nursing_Notes', 'HIS_One_IPD_Vital_Signs',
    'HIS_One_IPD_Medication_Orders', 'HIS_One_IPD_Radiology_Orders',
    'HIS_One_IPD_Procedures', 'HIS_One_IPD_Billing_Items',
    'HIS_One_IPD_Discharge_Summaries', 'HIS_One_IPD_Visits',
    'HIS_One_AM_Counters', 'HIS_One_OPD_Encounter_Revisions',
    'HIS_One_Result_Acknowledgments', 'opd_observations', 'opd_observation_notes'
  ]
  LOOP
    IF to_regclass(format('public.%I', table_name)) IS NOT NULL THEN
      EXECUTE format(
        'CREATE POLICY his_staff_read ON public.%I FOR SELECT TO authenticated USING (public.his_one_is_active_user())',
        table_name
      );
    END IF;
  END LOOP;
END
$$;

-- Role-scoped writes. Destructive DELETE operations remain admin-only.
DO $$
DECLARE
  item record;
BEGIN
  FOR item IN SELECT * FROM (VALUES
    ('HIS_One_Patients', ARRAY['doctor','reception']),
    ('HIS_One_Visits', ARRAY['doctor','nurse','reception']),
    ('HIS_One_OPD_Vital_Signs', ARRAY['doctor','nurse']),
    ('HIS_One_Appointments', ARRAY['doctor','nurse','reception']),
    ('HIS_One_Patient_Vaccines', ARRAY['doctor','nurse']),
    ('opd_observations', ARRAY['doctor','nurse']),
    ('opd_observation_notes', ARRAY['doctor','nurse']),
    ('HIS_One_Admissions', ARRAY['doctor','nurse','reception']),
    ('HIS_One_Bed_Movements', ARRAY['doctor','nurse']),
    ('HIS_One_IPD_Visits', ARRAY['doctor','nurse']),
    ('HIS_One_AM_Counters', ARRAY['doctor','nurse','reception']),
    ('HIS_One_IPD_Vital_Signs', ARRAY['doctor','nurse']),
    ('HIS_One_IPD_Doctor_Notes', ARRAY['doctor']),
    ('HIS_One_IPD_Nursing_Notes', ARRAY['nurse']),
    ('HIS_One_IPD_Medication_Orders', ARRAY['doctor']),
    ('HIS_One_IPD_Radiology_Orders', ARRAY['doctor']),
    ('HIS_One_IPD_Procedures', ARRAY['doctor']),
    ('HIS_One_IPD_Billing_Items', ARRAY['cashier']),
    ('HIS_One_IPD_Discharge_Summaries', ARRAY['doctor']),
    ('HIS_One_OPD_Encounter_Revisions', ARRAY['doctor']),
    ('HIS_One_Result_Acknowledgments', ARRAY['doctor','nurse'])
  ) AS v(table_name, roles)
  LOOP
    IF to_regclass(format('public.%I', item.table_name)) IS NOT NULL THEN
      EXECUTE format(
        'CREATE POLICY his_role_insert ON public.%I FOR INSERT TO authenticated WITH CHECK (public.his_one_current_role() = ANY (%L::text[]))',
        item.table_name, item.roles::text
      );
      EXECUTE format(
        'CREATE POLICY his_role_update ON public.%I FOR UPDATE TO authenticated USING (public.his_one_current_role() = ANY (%L::text[])) WITH CHECK (public.his_one_current_role() = ANY (%L::text[]))',
        item.table_name, item.roles::text, item.roles::text
      );
      EXECUTE format(
        'CREATE POLICY his_action_insert ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (public.his_one_can_table_write(%L, %L))',
        item.table_name, item.table_name, 'insert'
      );
      EXECUTE format(
        'CREATE POLICY his_action_update ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (public.his_one_can_table_write(%L, %L)) WITH CHECK (public.his_one_can_table_write(%L, %L))',
        item.table_name, item.table_name, 'update', item.table_name, 'update'
      );
    END IF;
  END LOOP;
END
$$;

-- Observation notes are additionally separated by clinical profession.
-- Doctors cannot sign nursing notes and nurses cannot sign doctor notes.
CREATE POLICY his_observation_note_role_insert ON public.opd_observation_notes
  AS RESTRICTIVE FOR INSERT TO authenticated
  WITH CHECK (
    public.his_one_is_admin()
    OR (public.his_one_current_role() = 'doctor' AND note_type IN ('DOCTOR_NOTE', 'PROCEDURE'))
    OR (public.his_one_current_role() = 'nurse' AND note_type IN ('VITAL_SIGN', 'NURSING_NOTE', 'PROCEDURE'))
  );
CREATE POLICY his_observation_note_role_update ON public.opd_observation_notes
  AS RESTRICTIVE FOR UPDATE TO authenticated
  USING (
    public.his_one_is_admin()
    OR (public.his_one_current_role() = 'doctor' AND note_type IN ('DOCTOR_NOTE', 'PROCEDURE'))
    OR (public.his_one_current_role() = 'nurse' AND note_type IN ('VITAL_SIGN', 'NURSING_NOTE', 'PROCEDURE'))
  )
  WITH CHECK (
    public.his_one_is_admin()
    OR (public.his_one_current_role() = 'doctor' AND note_type IN ('DOCTOR_NOTE', 'PROCEDURE'))
    OR (public.his_one_current_role() = 'nurse' AND note_type IN ('VITAL_SIGN', 'NURSING_NOTE', 'PROCEDURE'))
  );

-- Audit log is append-only for staff; only admins can read/delete it.
DO $$
BEGIN
  IF to_regclass('public."HIS_One_activity_logs"') IS NOT NULL THEN
    CREATE POLICY his_staff_audit_insert ON public."HIS_One_activity_logs"
      FOR INSERT TO authenticated WITH CHECK (public.his_one_is_active_user());
  END IF;
END
$$;

-- Sequences used by authenticated direct inserts must also be usable.
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
