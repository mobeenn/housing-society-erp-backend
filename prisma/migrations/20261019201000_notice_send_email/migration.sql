-- Additive opt-in for emailing published notices.
ALTER TABLE "notices" ADD COLUMN IF NOT EXISTS "sendEmail" BOOLEAN DEFAULT false;
