-- Safe baseline for the first Doctor and Nurse accounts.
-- Individual admins may reduce these permissions later, but application/API
-- role ceilings prevent either role from being elevated to administrator power.

UPDATE public."HIS_One_Users"
SET
  "Permissions" = 'dashboard,report,visit_history,patients,triage,opd,opd_observation,appointments,vaccines,ipd_ward_bed,ipd_inpatient_list',
  "ButtonPermissions" = '{
    "patients":{"view":true,"add":false,"edit":false,"delete":false,"triage":false,"print_qr":false},
    "triage":{"view":true,"edit":false,"delete":false,"call":false},
    "opd":{"view":true,"edit":true,"delete":false,"print":true},
    "opd_observation":{"view":true,"add":true,"note":true,"convert":true,"discharge":true},
    "labs":{"view":true,"add":true,"edit":false,"delete":false},
    "drugs":{"view":false,"add":false,"edit":false,"delete":false},
    "appointments":{"view":true,"add":true,"edit":true,"delete":false},
    "ipd":{"view":true,"admit":true,"transfer":true,"discharge":true,"chart_edit":true},
    "ipd_config":{"view":false,"add":false,"edit":false,"delete":false}
  }'::jsonb,
  "Updated_At" = now()
WHERE lower("Role") = 'doctor';

UPDATE public."HIS_One_Users"
SET
  "Permissions" = 'dashboard,report,visit_history,patients,triage,opd_observation,appointments,vaccines,ipd_ward_bed,ipd_inpatient_list',
  "ButtonPermissions" = '{
    "patients":{"view":true,"add":false,"edit":false,"delete":false,"triage":true,"print_qr":false},
    "triage":{"view":true,"edit":true,"delete":false,"call":true},
    "opd":{"view":false,"edit":false,"delete":false,"print":false},
    "opd_observation":{"view":true,"add":true,"note":true,"convert":false,"discharge":false},
    "labs":{"view":true,"add":false,"edit":false,"delete":false},
    "drugs":{"view":false,"add":false,"edit":false,"delete":false},
    "appointments":{"view":true,"add":true,"edit":false,"delete":false},
    "ipd":{"view":true,"admit":true,"transfer":true,"discharge":false,"chart_edit":true},
    "ipd_config":{"view":false,"add":false,"edit":false,"delete":false}
  }'::jsonb,
  "Updated_At" = now()
WHERE lower("Role") = 'nurse';
