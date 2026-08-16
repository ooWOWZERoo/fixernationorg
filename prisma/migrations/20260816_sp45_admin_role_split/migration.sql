-- SP-45: Split admin permission out of UserRole into a dedicated AdminRole field.
-- UserRole now covers only membership identity: CONSUMER | MEMBER | PROVIDER | AMBASSADOR
-- AdminRole covers staff permission: NONE | ADMIN | SUPER_ADMIN

-- 1. Create AdminRole enum
CREATE TYPE "AdminRole" AS ENUM ('NONE', 'ADMIN', 'SUPER_ADMIN');

-- 2. Add adminRole column (nullable initially so we can backfill before enforcing NOT NULL)
ALTER TABLE "User" ADD COLUMN "adminRole" "AdminRole";

-- 3. Backfill adminRole from existing role values
UPDATE "User" SET "adminRole" = 'SUPER_ADMIN' WHERE "role" = 'SUPER_ADMIN';
UPDATE "User" SET "adminRole" = 'ADMIN'       WHERE "role" = 'ADMIN';
UPDATE "User" SET "adminRole" = 'NONE'        WHERE "role" NOT IN ('ADMIN', 'SUPER_ADMIN');

-- 4. Reset base role to CONSUMER for users who were only admin (no known membership role)
UPDATE "User" SET "role" = 'CONSUMER' WHERE "role" IN ('ADMIN', 'SUPER_ADMIN');

-- 5. Apply NOT NULL + default now that every row has a value
ALTER TABLE "User" ALTER COLUMN "adminRole" SET NOT NULL;
ALTER TABLE "User" ALTER COLUMN "adminRole" SET DEFAULT 'NONE';

-- 6. Migrate AdminInvite.role from UserRole to AdminRole
--    Existing invites all have ADMIN or SUPER_ADMIN — cast via text
ALTER TABLE "AdminInvite" ALTER COLUMN "role" TYPE "AdminRole" USING "role"::text::"AdminRole";
