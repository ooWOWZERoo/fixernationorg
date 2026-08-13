-- Replace single GroupType enum with three boolean auto-join flags.
-- Existing groups: migrate AUTO_* values to their corresponding booleans, then drop the column.

ALTER TABLE "SocialGroup" ADD COLUMN "autoMember"     BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SocialGroup" ADD COLUMN "autoAmbassador" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SocialGroup" ADD COLUMN "autoProvider"   BOOLEAN NOT NULL DEFAULT false;

UPDATE "SocialGroup" SET "autoMember"     = true WHERE "type" = 'AUTO_MEMBER';
UPDATE "SocialGroup" SET "autoAmbassador" = true WHERE "type" = 'AUTO_AMBASSADOR';
UPDATE "SocialGroup" SET "autoProvider"   = true WHERE "type" = 'AUTO_PROVIDER';

ALTER TABLE "SocialGroup" DROP COLUMN "type";

DROP TYPE IF EXISTS "GroupType";
