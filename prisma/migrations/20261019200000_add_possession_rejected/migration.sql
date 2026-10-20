-- Additive: unused PossessionStatus enum gains Rejected (possession_applications.status remains String).
DO $$ BEGIN
  ALTER TYPE "PossessionStatus" ADD VALUE 'Rejected';
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;
