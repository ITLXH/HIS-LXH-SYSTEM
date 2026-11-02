-- Retire the redundant registration option; patient records are unchanged.
DELETE FROM public."HIS_One_MasterData"
WHERE "Category" = 'Occupation'
  AND "Value" = 'ນັກຮຽນ/ນັກສຶກສາ';
