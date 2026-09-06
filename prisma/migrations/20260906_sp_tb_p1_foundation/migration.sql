-- Tune Your Brain -- Phase 1 foundation. All models/enums for the full
-- 7-phase feature are created now so later phases are pure application-code
-- work with no further schema churn. Only TbContentItem/TbContentItemOption/
-- TbGameSession/TbGameLevel are populated in Phase 1 (Positive Reframe); the
-- rest sit unused until Phase 2+. See src/lib/tuneBrain/registry.ts and
-- src/pages/api/account/tune-your-brain/ for the Phase 1 application code.

-- AlterTable
ALTER TABLE "User" ADD COLUMN "timezone" TEXT;

-- CreateEnum
CREATE TYPE "TbGameKey" AS ENUM ('POSITIVE_REFRAME', 'GRATITUDE_QUEST', 'KINDNESS_QUEST', 'CALM_FOCUS', 'STRENGTH_SPOTTER', 'WELLNESS_CHOICES', 'POSITIVITY_RECALL', 'BUILD_GOOD_DAY');

-- CreateEnum
CREATE TYPE "TbContentStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'REJECTED');

-- CreateEnum
CREATE TYPE "TbLevelTier" AS ENUM ('STARTER', 'EXPLORER', 'BUILDER', 'CHALLENGER', 'SKILLED', 'ADVANCED', 'CHAMPION');

-- CreateEnum
CREATE TYPE "TbGoalPeriod" AS ENUM ('DAILY', 'WEEKLY', 'PERSONAL');

-- CreateEnum
CREATE TYPE "TbGoalStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'EXPIRED');

-- CreateTable
CREATE TABLE "TbContentItem" (
    "id" TEXT NOT NULL,
    "gameKey" "TbGameKey" NOT NULL,
    "status" "TbContentStatus" NOT NULL DEFAULT 'DRAFT',
    "difficulty" INTEGER,
    "category" TEXT,
    "prompt" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "validationStatus" "PositivityValidationStatus" NOT NULL DEFAULT 'PENDING',
    "validationNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdBy" TEXT,
    "updatedBy" TEXT,

    CONSTRAINT "TbContentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TbContentItemOption" (
    "id" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "isCorrectOrBest" BOOLEAN NOT NULL DEFAULT false,
    "explanation" TEXT,

    CONSTRAINT "TbContentItemOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TbGameSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameKey" "TbGameKey" NOT NULL,
    "contentItemId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "outcome" JSONB,
    "pointsAwarded" INTEGER NOT NULL DEFAULT 0,
    "xpAwarded" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TbGameSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TbGameLevel" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "gameKey" "TbGameKey" NOT NULL,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "tier" "TbLevelTier" NOT NULL DEFAULT 'STARTER',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TbGameLevel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Streak" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "scope" TEXT NOT NULL,
    "current" INTEGER NOT NULL DEFAULT 0,
    "longest" INTEGER NOT NULL DEFAULT 0,
    "lastActiveDate" DATE NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Streak_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TbBadge" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "gameKey" "TbGameKey",
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "tier" "TbLevelTier",
    "iconKey" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "pointsReward" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TbBadge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TbUserBadge" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TbUserBadge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BadgeFeature" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "badgeId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "BadgeFeature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TbGoal" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "period" "TbGoalPeriod" NOT NULL,
    "key" TEXT NOT NULL,
    "target" INTEGER NOT NULL,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "status" "TbGoalStatus" NOT NULL DEFAULT 'ACTIVE',
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "TbGoal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TbDailyChallenge" (
    "id" TEXT NOT NULL,
    "displayDate" DATE NOT NULL,
    "gameKey" "TbGameKey" NOT NULL,
    "contentItemId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TbDailyChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TbAnalyticsEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "name" TEXT NOT NULL,
    "gameKey" "TbGameKey",
    "properties" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TbAnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TbGratitudeEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TbGratitudeEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TbKindnessMission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contentItemId" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "moodAfter" INTEGER,
    "sessionId" TEXT NOT NULL,

    CONSTRAINT "TbKindnessMission_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TbContentItem_gameKey_status_idx" ON "TbContentItem"("gameKey", "status");

-- CreateIndex
CREATE INDEX "TbContentItem_gameKey_category_idx" ON "TbContentItem"("gameKey", "category");

-- CreateIndex
CREATE UNIQUE INDEX "TbContentItemOption_contentItemId_order_key" ON "TbContentItemOption"("contentItemId", "order");

-- CreateIndex
CREATE INDEX "TbGameSession_userId_gameKey_completedAt_idx" ON "TbGameSession"("userId", "gameKey", "completedAt");

-- CreateIndex
CREATE UNIQUE INDEX "TbGameLevel_userId_gameKey_key" ON "TbGameLevel"("userId", "gameKey");

-- CreateIndex
CREATE UNIQUE INDEX "Streak_userId_scope_key" ON "Streak"("userId", "scope");

-- CreateIndex
CREATE UNIQUE INDEX "TbBadge_key_key" ON "TbBadge"("key");

-- CreateIndex
CREATE UNIQUE INDEX "TbUserBadge_userId_badgeId_key" ON "TbUserBadge"("userId", "badgeId");

-- CreateIndex
CREATE UNIQUE INDEX "BadgeFeature_userId_badgeId_key" ON "BadgeFeature"("userId", "badgeId");

-- CreateIndex
CREATE INDEX "BadgeFeature_userId_order_idx" ON "BadgeFeature"("userId", "order");

-- CreateIndex
CREATE INDEX "TbGoal_userId_period_status_idx" ON "TbGoal"("userId", "period", "status");

-- CreateIndex
CREATE UNIQUE INDEX "TbGoal_userId_key_periodStart_key" ON "TbGoal"("userId", "key", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "TbDailyChallenge_displayDate_key" ON "TbDailyChallenge"("displayDate");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "TbAnalyticsEvent_name_createdAt_idx" ON "TbAnalyticsEvent"("name", "createdAt");

-- CreateIndex
CREATE INDEX "TbAnalyticsEvent_userId_idx" ON "TbAnalyticsEvent"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TbGratitudeEntry_sessionId_key" ON "TbGratitudeEntry"("sessionId");

-- CreateIndex
CREATE INDEX "TbGratitudeEntry_userId_createdAt_idx" ON "TbGratitudeEntry"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TbKindnessMission_sessionId_key" ON "TbKindnessMission"("sessionId");

-- CreateIndex
CREATE INDEX "TbKindnessMission_userId_completedAt_idx" ON "TbKindnessMission"("userId", "completedAt");

-- AddForeignKey
ALTER TABLE "TbContentItemOption" ADD CONSTRAINT "TbContentItemOption_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "TbContentItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TbGameSession" ADD CONSTRAINT "TbGameSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TbGameSession" ADD CONSTRAINT "TbGameSession_contentItemId_fkey" FOREIGN KEY ("contentItemId") REFERENCES "TbContentItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TbGameLevel" ADD CONSTRAINT "TbGameLevel_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Streak" ADD CONSTRAINT "Streak_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TbUserBadge" ADD CONSTRAINT "TbUserBadge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TbUserBadge" ADD CONSTRAINT "TbUserBadge_badgeId_fkey" FOREIGN KEY ("badgeId") REFERENCES "TbBadge"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BadgeFeature" ADD CONSTRAINT "BadgeFeature_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TbGoal" ADD CONSTRAINT "TbGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TbGratitudeEntry" ADD CONSTRAINT "TbGratitudeEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TbGratitudeEntry" ADD CONSTRAINT "TbGratitudeEntry_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TbGameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TbKindnessMission" ADD CONSTRAINT "TbKindnessMission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TbKindnessMission" ADD CONSTRAINT "TbKindnessMission_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TbGameSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;
