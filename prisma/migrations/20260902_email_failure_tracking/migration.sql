-- CreateTable
CREATE TABLE "EmailFailure" (
    "id" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "errorCode" TEXT,
    "errorMessage" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EmailFailure_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmailFailure_occurredAt_idx" ON "EmailFailure"("occurredAt");
