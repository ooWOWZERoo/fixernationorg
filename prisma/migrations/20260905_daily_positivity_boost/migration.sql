-- Your Daily Positivity Boost: approved-content library + one persisted
-- daily assignment per calendar day. See src/lib/positivityBoost.ts for the
-- selection algorithm and src/lib/positivityValidator.ts for the safety gate.

-- CreateEnum
CREATE TYPE "PositivityBoostStatus" AS ENUM ('DRAFT', 'APPROVED', 'ACTIVE', 'INACTIVE', 'REJECTED');

-- CreateEnum
CREATE TYPE "PositivityValidationStatus" AS ENUM ('PENDING', 'PASSED', 'FAILED');

-- CreateTable
CREATE TABLE "PositivityBoost" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "status" "PositivityBoostStatus" NOT NULL DEFAULT 'DRAFT',
    "validationStatus" "PositivityValidationStatus" NOT NULL DEFAULT 'PENDING',
    "validationNotes" TEXT,
    "isFallback" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,
    "lastDisplayedAt" TIMESTAMP(3),
    "displayCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PositivityBoost_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PositivityBoostAssignment" (
    "id" TEXT NOT NULL,
    "positivityBoostId" TEXT NOT NULL,
    "displayDate" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PositivityBoostAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PositivityBoost_content_key" ON "PositivityBoost"("content");

-- CreateIndex
CREATE INDEX "PositivityBoost_status_validationStatus_idx" ON "PositivityBoost"("status", "validationStatus");

-- CreateIndex
CREATE INDEX "PositivityBoost_category_idx" ON "PositivityBoost"("category");

-- CreateIndex
CREATE INDEX "PositivityBoost_lastDisplayedAt_idx" ON "PositivityBoost"("lastDisplayedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PositivityBoostAssignment_displayDate_key" ON "PositivityBoostAssignment"("displayDate");

-- CreateIndex
CREATE INDEX "PositivityBoostAssignment_positivityBoostId_idx" ON "PositivityBoostAssignment"("positivityBoostId");

-- AddForeignKey
ALTER TABLE "PositivityBoostAssignment" ADD CONSTRAINT "PositivityBoostAssignment_positivityBoostId_fkey" FOREIGN KEY ("positivityBoostId") REFERENCES "PositivityBoost"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
