DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_appointments_payment_method') THEN
    ALTER TABLE clinic_appointments
      ADD CONSTRAINT chk_appointments_payment_method
      CHECK (payment_method IS NULL OR payment_method IN ('cash', 'transfer'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_appointments_payment_status') THEN
    ALTER TABLE clinic_appointments
      ADD CONSTRAINT chk_appointments_payment_status
      CHECK (payment_status IN ('unpaid', 'paid'));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_appointments_amounts_non_negative') THEN
    ALTER TABLE clinic_appointments
      ADD CONSTRAINT chk_appointments_amounts_non_negative
      CHECK (
        (subtotal_vnd IS NULL OR subtotal_vnd >= 0)
        AND discount_vnd >= 0
        AND (total_vnd IS NULL OR total_vnd >= 0)
      );
  END IF;
END $$;
