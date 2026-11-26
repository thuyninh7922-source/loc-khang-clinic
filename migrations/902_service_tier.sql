ALTER TABLE clinic_appointments
  ADD COLUMN IF NOT EXISTS service_tier VARCHAR(16) NOT NULL DEFAULT 'standard';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_appointments_service_tier') THEN
    ALTER TABLE clinic_appointments
      ADD CONSTRAINT chk_appointments_service_tier
      CHECK (service_tier IN ('standard', 'premium'));
  END IF;
END $$;
