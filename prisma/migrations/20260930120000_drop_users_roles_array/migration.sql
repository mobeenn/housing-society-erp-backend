-- Consolidate user role membership onto the `user_roles` join table.
--
-- `users.roles` (a String[] duplicating the join table) is removed. The join
-- table is the single source of truth; `middlewares/auth.js`, `auth/service.js`
-- and `auth/user.model.js` all resolve roles through it.
--
-- The guard below refuses to drop the column if any user has role assignments
-- that exist only in the array, so this migration can never silently discard a
-- role assignment.

DO $$
DECLARE
    orphaned int;
BEGIN
    SELECT COUNT(*) INTO orphaned
    FROM "users" u
    WHERE COALESCE(array_length(u."roles", 1), 0) > 0
      AND NOT EXISTS (
          SELECT 1 FROM "user_roles" ur WHERE ur."userId" = u.id
      );

    IF orphaned > 0 THEN
        RAISE EXCEPTION
            'Refusing to drop users.roles: % user(s) have roles only in the array, not in user_roles. Run the role backfill first.',
            orphaned;
    END IF;
END $$;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "roles";
