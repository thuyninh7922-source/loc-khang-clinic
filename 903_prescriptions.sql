ALTER TABLE clinic_appointments
  ADD COLUMN IF NOT EXISTS prescription JSONB,
  ADD COLUMN IF NOT EXISTS prescription_total_vnd INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_appointments_prescription_total') THEN
    ALTER TABLE clinic_appointments
      ADD CONSTRAINT chk_appointments_prescription_total
      CHECK (prescription_total_vnd >= 0);
  END IF;
END $$;