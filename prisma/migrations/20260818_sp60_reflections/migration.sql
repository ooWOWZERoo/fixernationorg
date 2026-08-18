-- CreateTable
CREATE TABLE "ReflectionEntry" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT,
    "body" TEXT NOT NULL,
    "mood" INTEGER,
    "isPrivate" BOOLEAN NOT NULL DEFAULT true,
    "focusAreaId" TEXT,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ReflectionEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ReflectionEntry_userId_createdAt_idx" ON "ReflectionEntry"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "ReflectionEntry" ADD CONSTRAINT "ReflectionEntry_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
