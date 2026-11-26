-- Thanh toán, dịch vụ và hóa đơn cho lịch hẹn. An toàn khi chạy lại.
ALTER TABLE clinic_appointments
  ADD COLUMN IF NOT EXISTS billing JSONB,
  ADD COLUMN IF NOT EXISTS subtotal_vnd INTEGER,
  ADD COLUMN IF NOT EXISTS discount_vnd INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_vnd INTEGER,
  ADD COLUMN IF NOT EXISTS is_first_visit BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invoice_token TEXT;

CREATE INDEX IF NOT EXISTS idx_clinic_appointments_phone ON clinic_appointments (phone);
