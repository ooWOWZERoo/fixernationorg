-- CreateEnum
CREATE TYPE "ContactIdentityType" AS ENUM ('EMAIL', 'PHONE', 'EXTERNAL_ID');

-- CreateTable
CREATE TABLE "ContactIdentity" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "type" "ContactIdentityType" NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactIdentity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactMergeHistory" (
    "id" TEXT NOT NULL,
    "survivorId" TEXT NOT NULL,
    "absorbedId" TEXT NOT NULL,
    "absorbedEmail" TEXT NOT NULL,
    "mergedBy" TEXT NOT NULL,
    "mergedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactMergeHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContactIdentity_contactId_idx" ON "ContactIdentity"("contactId");

-- CreateIndex
CREATE INDEX "ContactIdentity_value_idx" ON "ContactIdentity"("value");

-- CreateIndex
CREATE INDEX "ContactMergeHistory_survivorId_idx" ON "ContactMergeHistory"("survivorId");

-- AddForeignKey
ALTER TABLE "ContactIdentity" ADD CONSTRAINT "ContactIdentity_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
