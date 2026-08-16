-- SP-33: Contact Activity Timeline

CREATE TYPE "ContactActivityType" AS ENUM (
  'NOTE_ADDED',
  'TAG_ADDED',
  'TAG_REMOVED',
  'LIST_JOINED',
  'LIST_REMOVED',
  'CONSENT_UPDATED',
  'CAMPAIGN_SENT',
  'CAMPAIGN_OPENED',
  'CAMPAIGN_CLICKED',
  'CAMPAIGN_BOUNCED',
  'CAMPAIGN_UNSUBSCRIBED',
  'CONTACT_UPDATED',
  'CONTACT_CREATED'
);

CREATE TABLE "ContactActivity" (
    "id"         TEXT NOT NULL,
    "contactId"  TEXT NOT NULL,
    "type"       "ContactActivityType" NOT NULL,
    "summary"    TEXT NOT NULL,
    "metadata"   JSONB,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContactActivity_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ContactActivity_contactId_occurredAt_idx" ON "ContactActivity"("contactId", "occurredAt" DESC);

ALTER TABLE "ContactActivity" ADD CONSTRAINT "ContactActivity_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
