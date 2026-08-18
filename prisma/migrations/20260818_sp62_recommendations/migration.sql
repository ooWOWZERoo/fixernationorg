-- CreateEnum
CREATE TYPE "RecommendationCategory" AS ENUM ('CHALLENGE', 'PATHWAY', 'ISSUE', 'CONTENT');

-- CreateEnum
CREATE TYPE "RecommendationAction" AS ENUM ('ACTED', 'SKIPPED', 'SAVED');

-- CreateTable
CREATE TABLE "Recommendation" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" "RecommendationCategory" NOT NULL,
    "resourceId" TEXT NOT NULL,
    "resourceTitle" TEXT NOT NULL,
    "resourceSlug" TEXT,
    "reason" TEXT,
    "date" DATE NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Recommendation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecommendationFeedback" (
    "id" TEXT NOT NULL,
    "recommendationId" TEXT NOT NULL,
    "action" "RecommendationAction" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RecommendationFeedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Recommendation_userId_date_key" ON "Recommendation"("userId", "date");

-- CreateIndex
CREATE INDEX "Recommendation_userId_date_idx" ON "Recommendation"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "RecommendationFeedback_recommendationId_key" ON "RecommendationFeedback"("recommendationId");

-- AddForeignKey
ALTER TABLE "Recommendation" ADD CONSTRAINT "Recommendation_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecommendationFeedback" ADD CONSTRAINT "RecommendationFeedback_recommendationId_fkey"
    FOREIGN KEY ("recommendationId") REFERENCES "Recommendation"("id") ON DELETE CASCADE ON UPDATE CASCADE;
