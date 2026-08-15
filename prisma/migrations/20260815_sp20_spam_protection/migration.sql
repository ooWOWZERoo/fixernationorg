-- SP-20: Spam protection — markedSpam flag on UserApplication + BlockedEmail blocklist

ALTER TABLE "UserApplication"
  ADD COLUMN "markedSpam"  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "markedSpamAt" TIMESTAMP(3);

CREATE TABLE "BlockedEmail" (
  "id"        TEXT         NOT NULL,
  "email"     TEXT         NOT NULL,
  "reason"    TEXT,
  "blockedBy" TEXT         NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BlockedEmail_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "BlockedEmail_email_key" ON "BlockedEmail"("email");
CREATE INDEX "BlockedEmail_email_idx" ON "BlockedEmail"("email");
