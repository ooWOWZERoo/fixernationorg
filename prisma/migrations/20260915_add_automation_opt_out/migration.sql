-- AlterTable: persist a category on each AutomationJourney so the send-time
-- gate can check per-category opt-outs (freeform admin-created journeys stay NULL)
ALTER TABLE "AutomationJourney" ADD COLUMN "category" TEXT;

-- AlterTable: per-user automation email opt-out preferences
ALTER TABLE "User" ADD COLUMN "automationsOptedOutAll" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "User" ADD COLUMN "automationCategoryOptOuts" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
