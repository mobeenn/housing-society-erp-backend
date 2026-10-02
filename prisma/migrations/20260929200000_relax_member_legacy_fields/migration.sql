-- Relax the members table to the shapes the legacy fileDB actually accepted.
--
-- Prisma's `migrate dev` wanted a full table reset for the address
-- String -> Json change, which it cannot do non-interactively. This migration
-- expresses the same end state with in-place ALTERs, so no data is rewritten
-- and no table is dropped.
--
-- * `name` becomes nullable: some legacy records carry only `fullName`.
-- * `address` becomes jsonb: the legacy value is polymorphic (a plain address
--   string on most rows, {current, permanent} on others). to_jsonb() wraps the
--   existing text as a JSON string so current values survive unchanged.
-- * `fullName`, `fatherName`, `contact` are added for the same legacy records.

-- AlterTable
ALTER TABLE "members" ALTER COLUMN "name" DROP NOT NULL;

-- AlterTable
ALTER TABLE "members"
    ALTER COLUMN "address" TYPE jsonb USING to_jsonb("address");

-- AlterTable
ALTER TABLE "members" ADD COLUMN "fullName" TEXT,
                        ADD COLUMN "fatherName" TEXT,
                        ADD COLUMN "contact" JSONB;
