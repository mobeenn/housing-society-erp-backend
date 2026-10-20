-- Installment → InstallmentPlan / Member foreign keys (P5-2; orphan check was clean)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'installments_plan_fkey'
  ) THEN
    ALTER TABLE "installments"
      ADD CONSTRAINT "installments_plan_fkey"
      FOREIGN KEY ("plan") REFERENCES "installment_plans"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'installments_member_fkey'
  ) THEN
    ALTER TABLE "installments"
      ADD CONSTRAINT "installments_member_fkey"
      FOREIGN KEY ("member") REFERENCES "members"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
