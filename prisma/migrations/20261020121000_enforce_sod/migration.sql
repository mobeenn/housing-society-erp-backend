-- Additive: maker–checker (segregation of duties) for approve flows.
ALTER TABLE "society_settings"
  ADD COLUMN IF NOT EXISTS "enforceSeparationOfDuties" BOOLEAN NOT NULL DEFAULT true;
