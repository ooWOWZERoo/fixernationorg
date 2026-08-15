-- SP-13: Onboarding checklist persistence
-- Adds ChecklistItem model with per-item status tracking

CREATE TYPE "ChecklistItemStatus" AS ENUM ('PENDING', 'PASSED', 'FAILED', 'NOT_APPLICABLE', 'ADDITIONAL_DOCS_REQUIRED');

CREATE TABLE "ChecklistItem" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "status" "ChecklistItemStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "updatedBy" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChecklistItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChecklistItem_applicationId_key_key" ON "ChecklistItem"("applicationId", "key");

ALTER TABLE "ChecklistItem" ADD CONSTRAINT "ChecklistItem_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "UserApplication"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
