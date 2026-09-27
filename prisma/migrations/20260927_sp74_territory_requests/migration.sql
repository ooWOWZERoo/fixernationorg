-- SP-74: Territory request / admin approval workflow
-- Self-service territory requests from ambassadors, providers and affiliates.
-- The admin's own direct assign/reassign on /admin/territories is unchanged
-- and never writes to this table.

-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "TerritoryRequestType" AS ENUM ('INITIAL', 'ADD', 'CHANGE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
    CREATE TYPE "TerritoryRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "TerritoryRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "applicationId" TEXT,
    "requestType" "TerritoryRequestType" NOT NULL,
    "requestedState" TEXT NOT NULL,
    "requestedCounty" TEXT NOT NULL,
    "existingAssignmentId" TEXT,
    "status" "TerritoryRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedBy" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "adminNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TerritoryRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "TerritoryRequest_userId_idx" ON "TerritoryRequest"("userId");
CREATE INDEX IF NOT EXISTS "TerritoryRequest_status_idx" ON "TerritoryRequest"("status");
CREATE INDEX IF NOT EXISTS "TerritoryRequest_existingAssignmentId_idx" ON "TerritoryRequest"("existingAssignmentId");

-- AddForeignKey
ALTER TABLE "TerritoryRequest" ADD CONSTRAINT "TerritoryRequest_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TerritoryRequest" ADD CONSTRAINT "TerritoryRequest_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "UserApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- SET NULL, not RESTRICT: a request row must never be the reason a
-- TerritoryAssignment can't be deleted (TerritoryAssignment.territoryId is
-- already RESTRICT from Territory, and e2e teardown deletes assignments
-- directly). Approved CHANGE history lives on TerritoryAssignment itself via
-- status = TRANSFERRED + transferredTo, so losing this pointer loses nothing
-- of record.
ALTER TABLE "TerritoryRequest" ADD CONSTRAINT "TerritoryRequest_existingAssignmentId_fkey"
    FOREIGN KEY ("existingAssignmentId") REFERENCES "TerritoryAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
