-- CreateEnum
CREATE TYPE "PathwayStageType" AS ENUM ('MORNING_BOOST', 'BLOG', 'RESOURCE', 'CHALLENGE', 'ACTION', 'GROUP', 'BOOK', 'EVENT', 'PROVIDER');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('ACTIVE', 'PAUSED', 'COMPLETED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "GrowthPathway" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "focusAreaIds" TEXT[],
    "estimatedDays" INTEGER NOT NULL DEFAULT 14,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GrowthPathway_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PathwayStage" (
    "id" TEXT NOT NULL,
    "pathwayId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "stageType" "PathwayStageType" NOT NULL DEFAULT 'ACTION',
    "contentId" TEXT,
    "contentTitle" TEXT,
    "actionPrompt" TEXT,
    "estimatedMinutes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PathwayStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PathwayEnrollment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "pathwayId" TEXT NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PathwayEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PathwayProgress" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "stageId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PathwayProgress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GrowthPathway_slug_key" ON "GrowthPathway"("slug");

-- CreateIndex
CREATE INDEX "PathwayStage_pathwayId_order_idx" ON "PathwayStage"("pathwayId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "PathwayEnrollment_userId_pathwayId_status_key" ON "PathwayEnrollment"("userId", "pathwayId", "status");

-- CreateIndex
CREATE INDEX "PathwayEnrollment_userId_status_idx" ON "PathwayEnrollment"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PathwayProgress_enrollmentId_stageId_key" ON "PathwayProgress"("enrollmentId", "stageId");

-- AddForeignKey
ALTER TABLE "PathwayStage" ADD CONSTRAINT "PathwayStage_pathwayId_fkey"
    FOREIGN KEY ("pathwayId") REFERENCES "GrowthPathway"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PathwayEnrollment" ADD CONSTRAINT "PathwayEnrollment_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PathwayEnrollment" ADD CONSTRAINT "PathwayEnrollment_pathwayId_fkey"
    FOREIGN KEY ("pathwayId") REFERENCES "GrowthPathway"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PathwayProgress" ADD CONSTRAINT "PathwayProgress_enrollmentId_fkey"
    FOREIGN KEY ("enrollmentId") REFERENCES "PathwayEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PathwayProgress" ADD CONSTRAINT "PathwayProgress_stageId_fkey"
    FOREIGN KEY ("stageId") REFERENCES "PathwayStage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
