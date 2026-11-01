-- Add registration options while preserving hospital-specific MasterData rows.
INSERT INTO public."HIS_One_MasterData" ("Category", "Value")
VALUES
  ('Channel', 'ສື່ໂຄສະນາ / Facebook'),
  ('Channel', 'ຕິດຕາມ'),
  ('Channel', 'ຜ່ານໂຮງໝໍອື່ນ'),
  ('Channel', 'Walk in'),
  ('Occupation', 'ເດັກ'),
  ('Occupation', 'ນັກຮຽນ/ນັກສຶກສາ'),
  ('Occupation', 'ພະນັກງານ'),
  ('Occupation', 'ປະຊາຊົນ/ອື່ນໆ'),
  ('Occupation', 'ນັກທຸລະກິດ')
ON CONFLICT ("Category", "Value") DO NOTHING;
