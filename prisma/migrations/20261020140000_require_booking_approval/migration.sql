ALTER TABLE "society_settings"
  ADD COLUMN IF NOT EXISTS "requireBookingApproval" BOOLEAN NOT NULL DEFAULT true;
