-- CreateEnum
CREATE TYPE "RecommendationType" AS ENUM ('PATHWAY', 'CHALLENGE', 'RESOURCE', 'BLOG_POST');

-- CreateTable
CREATE TABLE "IssueTopic" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "focusAreaId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "IssueTopic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IssueRecommendationMap" (
    "id" TEXT NOT NULL,
    "issueTopicId" TEXT NOT NULL,
    "recommendationType" "RecommendationType" NOT NULL,
    "resourceId" TEXT NOT NULL,
    "resourceTitle" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IssueRecommendationMap_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberIssue" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "issueTopicId" TEXT NOT NULL,
    "description" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MemberIssue_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "IssueTopic_slug_key" ON "IssueTopic"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "IssueRecommendationMap_issueTopicId_recommendationType_resourceId_key" ON "IssueRecommendationMap"("issueTopicId", "recommendationType", "resourceId");

-- CreateIndex
CREATE INDEX "IssueRecommendationMap_issueTopicId_priority_idx" ON "IssueRecommendationMap"("issueTopicId", "priority");

-- CreateIndex
CREATE INDEX "MemberIssue_userId_createdAt_idx" ON "MemberIssue"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "IssueRecommendationMap" ADD CONSTRAINT "IssueRecommendationMap_issueTopicId_fkey"
    FOREIGN KEY ("issueTopicId") REFERENCES "IssueTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberIssue" ADD CONSTRAINT "MemberIssue_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberIssue" ADD CONSTRAINT "MemberIssue_issueTopicId_fkey"
    FOREIGN KEY ("issueTopicId") REFERENCES "IssueTopic"("id") ON UPDATE CASCADE;
