-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "PlanItemType" AS ENUM ('CONTENT', 'ACTION', 'PATHWAY', 'CHALLENGE', 'GROUP', 'PROVIDER', 'BOOK', 'EVENT');

-- CreateEnum
CREATE TYPE "ActionStatus" AS ENUM ('PENDING', 'COMPLETED', 'SKIPPED');

-- CreateTable
CREATE TABLE "FixerPlan" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "focusAreaId" TEXT,
    "status" "PlanStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FixerPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FixerPlanItem" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "type" "PlanItemType" NOT NULL,
    "refId" TEXT,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "status" "ActionStatus" NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FixerPlanItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberAction" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3),
    "source" TEXT,
    "planId" TEXT,
    "status" "ActionStatus" NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MemberAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FixerPlan_userId_status_idx" ON "FixerPlan"("userId", "status");

-- CreateIndex
CREATE INDEX "FixerPlanItem_planId_status_idx" ON "FixerPlanItem"("planId", "status");

-- CreateIndex
CREATE INDEX "MemberAction_userId_status_idx" ON "MemberAction"("userId", "status");

-- AddForeignKey
ALTER TABLE "FixerPlan" ADD CONSTRAINT "FixerPlan_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixerPlan" ADD CONSTRAINT "FixerPlan_focusAreaId_fkey"
    FOREIGN KEY ("focusAreaId") REFERENCES "FocusArea"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FixerPlanItem" ADD CONSTRAINT "FixerPlanItem_planId_fkey"
    FOREIGN KEY ("planId") REFERENCES "FixerPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberAction" ADD CONSTRAINT "MemberAction_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberAction" ADD CONSTRAINT "MemberAction_planId_fkey"
    FOREIGN KEY ("planId") REFERENCES "FixerPlan"("id") ON DELETE SET NULL ON UPDATE CASCADE;
