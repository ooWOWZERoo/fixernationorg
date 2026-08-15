-- SP-25: NewsletterTopic + ContactSubscription

CREATE TABLE "NewsletterTopic" (
    "id"          TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "slug"        TEXT NOT NULL,
    "description" TEXT,
    "active"      BOOLEAN NOT NULL DEFAULT true,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,
    CONSTRAINT "NewsletterTopic_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NewsletterTopic_slug_key" ON "NewsletterTopic"("slug");

CREATE TABLE "ContactSubscription" (
    "id"        TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "topicId"   TEXT NOT NULL,
    "active"    BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ContactSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ContactSubscription_contactId_topicId_key" ON "ContactSubscription"("contactId", "topicId");
CREATE INDEX "ContactSubscription_contactId_idx" ON "ContactSubscription"("contactId");
CREATE INDEX "ContactSubscription_topicId_idx" ON "ContactSubscription"("topicId");

ALTER TABLE "ContactSubscription"
    ADD CONSTRAINT "ContactSubscription_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ContactSubscription"
    ADD CONSTRAINT "ContactSubscription_topicId_fkey"
    FOREIGN KEY ("topicId") REFERENCES "NewsletterTopic"("id") ON DELETE CASCADE ON UPDATE CASCADE;
