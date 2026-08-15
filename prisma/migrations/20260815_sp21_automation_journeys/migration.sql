-- CreateEnum
CREATE TYPE "AutomationTrigger" AS ENUM ('MANUAL', 'SIGNUP', 'ROLE_CHANGE', 'TAG_ADDED', 'APPLICATION_ACCEPTED');

-- CreateEnum
CREATE TYPE "AutomationStepType" AS ENUM ('WAIT', 'SEND_EMAIL', 'ADD_TAG', 'WEBHOOK');

-- CreateEnum
CREATE TYPE "AutomationEnrollmentStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'PAUSED', 'CANCELLED', 'FAILED');

-- CreateTable
CREATE TABLE "AutomationJourney" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trigger" "AutomationTrigger" NOT NULL,
    "triggerConfig" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AutomationJourney_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AutomationJourney_trigger_active_idx" ON "AutomationJourney"("trigger", "active");

-- CreateTable
CREATE TABLE "AutomationStep" (
    "id" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "type" "AutomationStepType" NOT NULL,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AutomationStep_pkey" PRIMARY KEY ("id")
);

-- CreateUnique
CREATE UNIQUE INDEX "AutomationStep_journeyId_order_key" ON "AutomationStep"("journeyId", "order");

-- CreateIndex
CREATE INDEX "AutomationStep_journeyId_idx" ON "AutomationStep"("journeyId");

-- AddForeignKey
ALTER TABLE "AutomationStep" ADD CONSTRAINT "AutomationStep_journeyId_fkey"
    FOREIGN KEY ("journeyId") REFERENCES "AutomationJourney"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "AutomationEnrollment" (
    "id" TEXT NOT NULL,
    "journeyId" TEXT NOT NULL,
    "contactId" TEXT,
    "userId" TEXT,
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "status" "AutomationEnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "metadata" JSONB,
    CONSTRAINT "AutomationEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AutomationEnrollment_journeyId_status_idx" ON "AutomationEnrollment"("journeyId", "status");

-- CreateIndex
CREATE INDEX "AutomationEnrollment_status_nextRunAt_idx" ON "AutomationEnrollment"("status", "nextRunAt");

-- CreateIndex
CREATE INDEX "AutomationEnrollment_userId_idx" ON "AutomationEnrollment"("userId");

-- CreateIndex
CREATE INDEX "AutomationEnrollment_contactId_idx" ON "AutomationEnrollment"("contactId");

-- AddForeignKey
ALTER TABLE "AutomationEnrollment" ADD CONSTRAINT "AutomationEnrollment_journeyId_fkey"
    FOREIGN KEY ("journeyId") REFERENCES "AutomationJourney"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "AutomationEvent" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "stepOrder" INTEGER,
    "type" TEXT NOT NULL,
    "metadata" JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AutomationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AutomationEvent_enrollmentId_occurredAt_idx" ON "AutomationEvent"("enrollmentId", "occurredAt");

-- AddForeignKey
ALTER TABLE "AutomationEvent" ADD CONSTRAINT "AutomationEvent_enrollmentId_fkey"
    FOREIGN KEY ("enrollmentId") REFERENCES "AutomationEnrollment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
