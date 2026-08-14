-- CreateTable
CREATE TABLE "MorningBoost" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "excerpt" TEXT,
    "body" TEXT NOT NULL,
    "imageUrl" TEXT,
    "authorName" TEXT NOT NULL DEFAULT 'Anthony J. Placito',
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MorningBoost_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MorningBoost_slug_key" ON "MorningBoost"("slug");

-- CreateIndex
CREATE INDEX "MorningBoost_publishedAt_idx" ON "MorningBoost"("publishedAt");
