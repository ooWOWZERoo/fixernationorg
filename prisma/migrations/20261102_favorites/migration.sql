-- Favorites: private per-member stars on blog posts and Morning Boost entries.
-- Purely additive (two new tables); no existing table is altered.

-- CreateTable
CREATE TABLE "BlogFavorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "blogPostId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BlogFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MorningBoostFavorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "morningBoostId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MorningBoostFavorite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BlogFavorite_userId_createdAt_idx" ON "BlogFavorite"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BlogFavorite_userId_blogPostId_key" ON "BlogFavorite"("userId", "blogPostId");

-- CreateIndex
CREATE INDEX "MorningBoostFavorite_userId_createdAt_idx" ON "MorningBoostFavorite"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MorningBoostFavorite_userId_morningBoostId_key" ON "MorningBoostFavorite"("userId", "morningBoostId");

-- AddForeignKey
ALTER TABLE "BlogFavorite" ADD CONSTRAINT "BlogFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BlogFavorite" ADD CONSTRAINT "BlogFavorite_blogPostId_fkey" FOREIGN KEY ("blogPostId") REFERENCES "BlogPost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MorningBoostFavorite" ADD CONSTRAINT "MorningBoostFavorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MorningBoostFavorite" ADD CONSTRAINT "MorningBoostFavorite_morningBoostId_fkey" FOREIGN KEY ("morningBoostId") REFERENCES "MorningBoost"("id") ON DELETE CASCADE ON UPDATE CASCADE;

