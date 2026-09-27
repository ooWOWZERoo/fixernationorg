-- hosting.com caps outgoing mail at 100 messages/hour PER MAILBOX and
-- suspends the mailbox for the rest of the hour when that's exceeded
-- (confirmed with their support). The previous guard counted CampaignSend
-- rows sent in the last hour and held the result in memory for the duration
-- of an invocation -- a read-once snapshot, not a reservation. Three campaign
-- crons fire on the same `0 * * * *` schedule as independent Vercel
-- invocations, so each could read the same base count and independently spend
-- what it believed was the entire remaining budget.
--
-- This table replaces that: one row per (mailbox, UTC hour), claimed with an
-- atomic `UPDATE ... SET count = count + 1 WHERE key = $1 AND count < cap`.
-- Postgres evaluates the predicate and the increment together, so concurrent
-- invocations serialize on the row and the cap holds account-wide.

CREATE TABLE "MailboxSendCounter" (
    "key" TEXT NOT NULL,
    "mailbox" TEXT NOT NULL,
    "hourKey" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "MailboxSendCounter_pkey" PRIMARY KEY ("key")
);

CREATE INDEX "MailboxSendCounter_hourKey_idx" ON "MailboxSendCounter"("hourKey");
