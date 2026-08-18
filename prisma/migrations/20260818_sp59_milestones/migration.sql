-- CreateTable
CREATE TABLE "MemberMilestone" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "resourceId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "awardedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MemberMilestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberRecognition" (
    "id" TEXT NOT NULL,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isPublic" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MemberRecognition_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MemberMilestone_userId_type_resourceId_key" ON "MemberMilestone"("userId", "type", "resourceId");

-- CreateIndex
CREATE INDEX "MemberMilestone_userId_awardedAt_idx" ON "MemberMilestone"("userId", "awardedAt");

-- CreateIndex
CREATE INDEX "MemberRecognition_toUserId_createdAt_idx" ON "MemberRecognition"("toUserId", "createdAt");

-- CreateIndex
CREATE INDEX "MemberRecognition_fromUserId_createdAt_idx" ON "MemberRecognition"("fromUserId", "createdAt");

-- AddForeignKey
ALTER TABLE "MemberMilestone" ADD CONSTRAINT "MemberMilestone_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberRecognition" ADD CONSTRAINT "MemberRecognition_fromUserId_fkey"
    FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MemberRecognition" ADD CONSTRAINT "MemberRecognition_toUserId_fkey"
    FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
