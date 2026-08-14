-- CreateEnum
CREATE TYPE "ApplicationType" AS ENUM ('PROVIDER', 'AMBASSADOR');

-- CreateEnum
CREATE TYPE "ApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "UserApplication" (
    "id" TEXT NOT NULL,
    "type" "ApplicationType" NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "businessName" TEXT,
    "userId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserApplication_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "UserApplication_type_status_idx" ON "UserApplication"("type", "status");

-- CreateIndex
CREATE INDEX "UserApplication_email_idx" ON "UserApplication"("email");
