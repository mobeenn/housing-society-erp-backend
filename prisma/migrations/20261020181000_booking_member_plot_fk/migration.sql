-- Booking → Member / Plot foreign keys (P5-2; orphan check was clean)

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bookings_member_fkey'
  ) THEN
    ALTER TABLE "bookings"
      ADD CONSTRAINT "bookings_member_fkey"
      FOREIGN KEY ("member") REFERENCES "members"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bookings_plot_fkey'
  ) THEN
    ALTER TABLE "bookings"
      ADD CONSTRAINT "bookings_plot_fkey"
      FOREIGN KEY ("plot") REFERENCES "plots"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
