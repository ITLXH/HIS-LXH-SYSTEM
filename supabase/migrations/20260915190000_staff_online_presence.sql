-- Private staff presence only; does not change existing public queue channels.
CREATE POLICY "his_staff_presence_read" ON realtime.messages
FOR SELECT TO authenticated
USING (
  realtime.topic() = 'his:staff:presence'
  AND extension = 'presence'
  AND EXISTS (SELECT 1 FROM public."HIS_One_Users" WHERE "Auth_User_ID" = auth.uid() AND "Status" = 'active')
);

CREATE POLICY "his_staff_presence_write" ON realtime.messages
FOR INSERT TO authenticated
WITH CHECK (
  realtime.topic() = 'his:staff:presence'
  AND extension = 'presence'
  AND EXISTS (SELECT 1 FROM public."HIS_One_Users" WHERE "Auth_User_ID" = auth.uid() AND "Status" = 'active')
);
