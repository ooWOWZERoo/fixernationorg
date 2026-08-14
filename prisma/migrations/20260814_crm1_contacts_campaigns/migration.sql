-- CRM Phase 1: Contacts, Consent, Lists, Templates, Campaigns

-- Enums
CREATE TYPE "ContactConsentTopic" AS ENUM ('MORNING_BOOST', 'CAMPAIGNS', 'NEWSLETTERS', 'PRODUCT_UPDATES');
CREATE TYPE "ContactListOwnerType" AS ENUM ('FN_ADMIN', 'AMBASSADOR', 'PROVIDER');
CREATE TYPE "CampaignStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'SENDING', 'SENT', 'PAUSED', 'CANCELLED');
CREATE TYPE "CampaignSendStatus" AS ENUM ('QUEUED', 'SENT', 'OPENED', 'CLICKED', 'BOUNCED', 'UNSUBSCRIBED');

-- Contact
CREATE TABLE "Contact" (
    "id"        TEXT NOT NULL,
    "email"     TEXT NOT NULL,
    "firstName" TEXT,
    "lastName"  TEXT,
    "phone"     TEXT,
    "company"   TEXT,
    "source"    TEXT,
    "userId"    TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Contact_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Contact_email_key" ON "Contact"("email");
CREATE UNIQUE INDEX "Contact_userId_key" ON "Contact"("userId");
CREATE INDEX "Contact_email_idx" ON "Contact"("email");
CREATE INDEX "Contact_userId_idx" ON "Contact"("userId");
ALTER TABLE "Contact" ADD CONSTRAINT "Contact_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ContactAddress
CREATE TABLE "ContactAddress" (
    "id"        TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "street"    TEXT,
    "city"      TEXT,
    "state"     TEXT,
    "zip"       TEXT,
    "country"   TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ContactAddress_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ContactAddress_contactId_key" ON "ContactAddress"("contactId");
ALTER TABLE "ContactAddress" ADD CONSTRAINT "ContactAddress_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ContactConsent
CREATE TABLE "ContactConsent" (
    "id"         TEXT NOT NULL,
    "contactId"  TEXT NOT NULL,
    "topic"      "ContactConsentTopic" NOT NULL,
    "optedIn"    BOOLEAN NOT NULL DEFAULT true,
    "optedInAt"  TIMESTAMP(3),
    "optedOutAt" TIMESTAMP(3),
    "source"     TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"  TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ContactConsent_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ContactConsent_contactId_topic_key" ON "ContactConsent"("contactId", "topic");
CREATE INDEX "ContactConsent_contactId_idx" ON "ContactConsent"("contactId");
CREATE INDEX "ContactConsent_topic_optedIn_idx" ON "ContactConsent"("topic", "optedIn");
ALTER TABLE "ContactConsent" ADD CONSTRAINT "ContactConsent_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ContactTag
CREATE TABLE "ContactTag" (
    "id"        TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "tag"       TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContactTag_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ContactTag_contactId_tag_key" ON "ContactTag"("contactId", "tag");
CREATE INDEX "ContactTag_contactId_idx" ON "ContactTag"("contactId");
CREATE INDEX "ContactTag_tag_idx" ON "ContactTag"("tag");
ALTER TABLE "ContactTag" ADD CONSTRAINT "ContactTag_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ContactNote
CREATE TABLE "ContactNote" (
    "id"        TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "authorId"  TEXT,
    "body"      TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContactNote_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ContactNote_contactId_idx" ON "ContactNote"("contactId");
ALTER TABLE "ContactNote" ADD CONSTRAINT "ContactNote_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ContactList
CREATE TABLE "ContactList" (
    "id"          TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "description" TEXT,
    "ownerType"   "ContactListOwnerType" NOT NULL DEFAULT 'FN_ADMIN',
    "ownerUserId" TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ContactList_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ContactList_ownerType_ownerUserId_idx" ON "ContactList"("ownerType", "ownerUserId");

-- ContactListMember
CREATE TABLE "ContactListMember" (
    "id"        TEXT NOT NULL,
    "listId"    TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "addedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContactListMember_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ContactListMember_listId_contactId_key" ON "ContactListMember"("listId", "contactId");
CREATE INDEX "ContactListMember_listId_idx" ON "ContactListMember"("listId");
CREATE INDEX "ContactListMember_contactId_idx" ON "ContactListMember"("contactId");
ALTER TABLE "ContactListMember" ADD CONSTRAINT "ContactListMember_listId_fkey"
    FOREIGN KEY ("listId") REFERENCES "ContactList"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ContactListMember" ADD CONSTRAINT "ContactListMember_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- EmailTemplate
CREATE TABLE "EmailTemplate" (
    "id"        TEXT NOT NULL,
    "name"      TEXT NOT NULL,
    "subject"   TEXT NOT NULL,
    "htmlBody"  TEXT NOT NULL,
    "textBody"  TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "EmailTemplate_pkey" PRIMARY KEY ("id")
);

-- Campaign
CREATE TABLE "Campaign" (
    "id"          TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "status"      "CampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "subject"     TEXT NOT NULL,
    "fromName"    TEXT NOT NULL DEFAULT 'Fixer Nation',
    "fromEmail"   TEXT NOT NULL DEFAULT 'campaigns@fixernation.org',
    "htmlBody"    TEXT NOT NULL,
    "textBody"    TEXT,
    "templateId"  TEXT,
    "listId"      TEXT,
    "scheduledAt" TIMESTAMP(3),
    "sentAt"      TIMESTAMP(3),
    "createdBy"   TEXT,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "Campaign_status_idx" ON "Campaign"("status");
CREATE INDEX "Campaign_scheduledAt_idx" ON "Campaign"("scheduledAt");
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "EmailTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "Campaign" ADD CONSTRAINT "Campaign_listId_fkey"
    FOREIGN KEY ("listId") REFERENCES "ContactList"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CampaignSend
CREATE TABLE "CampaignSend" (
    "id"         TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "contactId"  TEXT NOT NULL,
    "status"     "CampaignSendStatus" NOT NULL DEFAULT 'QUEUED',
    "sentAt"     TIMESTAMP(3),
    "openedAt"   TIMESTAMP(3),
    "clickedAt"  TIMESTAMP(3),
    "bouncedAt"  TIMESTAMP(3),
    "unsubAt"    TIMESTAMP(3),
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CampaignSend_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CampaignSend_campaignId_contactId_key" ON "CampaignSend"("campaignId", "contactId");
CREATE INDEX "CampaignSend_campaignId_idx" ON "CampaignSend"("campaignId");
CREATE INDEX "CampaignSend_contactId_idx" ON "CampaignSend"("contactId");
CREATE INDEX "CampaignSend_status_idx" ON "CampaignSend"("status");
ALTER TABLE "CampaignSend" ADD CONSTRAINT "CampaignSend_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "Campaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CampaignSend" ADD CONSTRAINT "CampaignSend_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
