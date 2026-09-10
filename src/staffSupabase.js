const STAFF_AVATAR_BUCKET = 'his-staff-avatars';

function clean(value) {
  return String(value ?? '').trim();
}

function mapStaffRow(row = {}, photoUrl = '') {
  return {
    id: clean(row.ID),
    employeeCode: clean(row.Employee_Code),
    fullName: clean(row.Full_Name),
    employeeType: clean(row.Employee_Type),
    department: clean(row.Department),
    position: clean(row.Position),
    specialty: clean(row.Specialty),
    phone: clean(row.Phone),
    email: clean(row.Email),
    status: clean(row.Status),
    linkedUserId: clean(row.User_ID),
    photoPath: clean(row.Photo_Path),
    photoData: clean(photoUrl),
    createdAt: clean(row.Created_At),
    updatedAt: clean(row.Updated_At)
  };
}

function staffRecordPayload(record, photoPath) {
  const linkedUserId = clean(record.linkedUserId);
  if (linkedUserId && !/^\d+$/.test(linkedUserId)) {
    throw new Error('User ID ຕ້ອງເປັນຕົວເລກ');
  }
  return {
    ID: record.id,
    User_ID: linkedUserId ? Number(linkedUserId) : null,
    Employee_Code: clean(record.employeeCode).toUpperCase(),
    Full_Name: clean(record.fullName),
    Employee_Type: clean(record.employeeType),
    Department: clean(record.department),
    Position: clean(record.position) || null,
    Specialty: clean(record.specialty) || null,
    Phone: clean(record.phone) || null,
    Email: clean(record.email).toLowerCase() || null,
    Photo_Path: clean(photoPath) || null,
    Status: clean(record.status) || 'active'
  };
}

async function signedAvatarUrl(client, path) {
  if (!path) return '';
  const { data, error } = await client.storage.from(STAFF_AVATAR_BUCKET).createSignedUrl(path, 6 * 60 * 60);
  if (error) {
    console.warn('Unable to sign staff avatar URL:', error.message);
    return '';
  }
  return data?.signedUrl || '';
}

export function createStaffSupabaseBackend({ client, tableName }) {
  if (!client || !tableName) throw new Error('Staff Supabase backend requires a client and table name');
  return {
    async load() {
      const { data, error } = await client
        .from(tableName)
        .select('ID,User_ID,Employee_Code,Full_Name,Employee_Type,Department,Position,Specialty,Phone,Email,Photo_Path,Status,Created_At,Updated_At')
        .order('Status', { ascending: true })
        .order('Employee_Type', { ascending: true })
        .order('Full_Name', { ascending: true });
      if (error) throw new Error(`Staff Profiles: ${error.message}`);
      return Promise.all((data || []).map(async row => mapStaffRow(row, await signedAvatarUrl(client, row.Photo_Path))));
    },

    async save(record, existing = null) {
      const oldPhotoPath = clean(existing?.photoPath);
      let nextPhotoPath = clean(record.photoPath);
      let uploadedPhotoPath = '';
      const hasNewPhoto = /^data:image\/(?:jpeg|png|webp);base64,/i.test(clean(record.photoData));
      if (hasNewPhoto) {
        const response = await fetch(record.photoData);
        const blob = await response.blob();
        uploadedPhotoPath = `${record.id}/${Date.now()}.jpg`;
        const { error: uploadError } = await client.storage
          .from(STAFF_AVATAR_BUCKET)
          .upload(uploadedPhotoPath, blob, { contentType: 'image/jpeg', cacheControl: '3600', upsert: false });
        if (uploadError) throw new Error(`Avatar upload: ${uploadError.message}`);
        nextPhotoPath = uploadedPhotoPath;
      }

      const payload = staffRecordPayload(record, nextPhotoPath);
      const { data, error } = await client
        .from(tableName)
        .upsert(payload, { onConflict: 'ID' })
        .select('ID,User_ID,Employee_Code,Full_Name,Employee_Type,Department,Position,Specialty,Phone,Email,Photo_Path,Status,Created_At,Updated_At')
        .single();
      if (error) {
        if (uploadedPhotoPath) await client.storage.from(STAFF_AVATAR_BUCKET).remove([uploadedPhotoPath]);
        throw new Error(`Staff Profile save: ${error.message}`);
      }

      if (oldPhotoPath && oldPhotoPath !== nextPhotoPath) {
        const { error: removeError } = await client.storage.from(STAFF_AVATAR_BUCKET).remove([oldPhotoPath]);
        if (removeError) console.warn('Old staff avatar cleanup failed:', removeError.message);
      }
      return mapStaffRow(data, await signedAvatarUrl(client, data.Photo_Path));
    },

    async remove(record) {
      const { error } = await client.from(tableName).delete().eq('ID', record.id);
      if (error) throw new Error(`Staff Profile delete: ${error.message}`);
      const photoPath = clean(record.photoPath);
      if (photoPath) {
        const { error: photoError } = await client.storage.from(STAFF_AVATAR_BUCKET).remove([photoPath]);
        if (photoError) console.warn('Staff avatar cleanup failed:', photoError.message);
      }
    }
  };
}

export { STAFF_AVATAR_BUCKET, mapStaffRow, staffRecordPayload };
