ALTER TABLE clinic_accounts
  ADD COLUMN IF NOT EXISTS location_id VARCHAR(64),
  ADD COLUMN IF NOT EXISTS doctor_name VARCHAR(120);

-- Xóa ràng buộc role cũ (nếu có) và thêm vai trò 'doctor'
DO $$
DECLARE
  c_name text;
BEGIN
  SELECT conname INTO c_name
  FROM pg_constraint
  WHERE conrelid = 'clinic_accounts'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) LIKE '%role%';
  IF c_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE clinic_accounts DROP CONSTRAINT %I', c_name);
  END IF;
END $$;

ALTER TABLE clinic_accounts
  ADD CONSTRAINT chk_accounts_role CHECK (role IN ('patient', 'admin', 'doctor'));
