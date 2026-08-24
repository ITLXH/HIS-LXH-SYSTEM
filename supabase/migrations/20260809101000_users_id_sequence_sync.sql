-- Imported rows can leave a serial/identity sequence behind MAX(ID), causing
-- the next staff profile insert to collide with an existing primary key.
DO $$
DECLARE
  seq_name text;
  max_id bigint;
BEGIN
  seq_name := pg_get_serial_sequence('public."HIS_One_Users"', 'ID');
  IF seq_name IS NOT NULL THEN
    SELECT COALESCE(MAX("ID"), 0) INTO max_id FROM public."HIS_One_Users";
    IF max_id > 0 THEN
      PERFORM setval(seq_name, max_id, true);
    ELSE
      PERFORM setval(seq_name, 1, false);
    END IF;
  END IF;
END
$$;
