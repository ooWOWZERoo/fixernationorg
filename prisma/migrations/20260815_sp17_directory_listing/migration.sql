-- AlterTable: add provider directory listing flag to UserApplication
ALTER TABLE "UserApplication"
  ADD COLUMN "directoryListed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "directoryListedAt" TIMESTAMP(3);
