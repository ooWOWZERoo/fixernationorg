-- CRM Phase 2: Extended contact fields + multi-address support

-- New Contact fields
ALTER TABLE "Contact" ADD COLUMN "phone2" TEXT;
ALTER TABLE "Contact" ADD COLUMN "email2" TEXT;
ALTER TABLE "Contact" ADD COLUMN "lastActivity" TEXT;
ALTER TABLE "Contact" ADD COLUMN "lastActivityAt" TIMESTAMPTZ;

-- ContactAddress: add new fields
ALTER TABLE "ContactAddress" ADD COLUMN "type" TEXT;
ALTER TABLE "ContactAddress" ADD COLUMN "street2" TEXT;
ALTER TABLE "ContactAddress" ADD COLUMN "isPrimary" BOOLEAN NOT NULL DEFAULT true;

-- Convert ContactAddress from one-to-one to one-to-many
DROP INDEX "ContactAddress_contactId_key";
CREATE INDEX "ContactAddress_contactId_idx" ON "ContactAddress"("contactId");
