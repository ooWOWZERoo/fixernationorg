CREATE TYPE "RsvpStatus" AS ENUM ('REGISTERED', 'CANCELLED', 'WAITLISTED');

CREATE TABLE "Event" (
  "id"          TEXT NOT NULL,
  "slug"        TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "description" TEXT,
  "coverUrl"    TEXT,
  "location"    TEXT,
  "isVirtual"   BOOLEAN NOT NULL DEFAULT false,
  "meetingUrl"  TEXT,
  "startsAt"    TIMESTAMP(3) NOT NULL,
  "endsAt"      TIMESTAMP(3),
  "capacity"    INTEGER,
  "priceCents"  INTEGER NOT NULL DEFAULT 0,
  "publishedAt" TIMESTAMP(3),
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Event_slug_key"         ON "Event"("slug");
CREATE INDEX "Event_startsAt_idx"            ON "Event"("startsAt");
CREATE INDEX "Event_publishedAt_idx"         ON "Event"("publishedAt");

CREATE TABLE "EventRsvp" (
  "id"        TEXT NOT NULL,
  "eventId"   TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "status"    "RsvpStatus" NOT NULL DEFAULT 'REGISTERED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EventRsvp_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "EventRsvp_eventId_userId_key" ON "EventRsvp"("eventId", "userId");
CREATE INDEX "EventRsvp_eventId_idx"               ON "EventRsvp"("eventId");
CREATE INDEX "EventRsvp_userId_idx"                ON "EventRsvp"("userId");
ALTER TABLE "EventRsvp"
  ADD CONSTRAINT "EventRsvp_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "EventRsvp_userId_fkey"  FOREIGN KEY ("userId")  REFERENCES "User"("id")  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "GiftCode" (
  "id"               TEXT NOT NULL,
  "code"             TEXT NOT NULL,
  "grantedRole"      "UserRole" NOT NULL DEFAULT 'MEMBER',
  "description"      TEXT,
  "redeemedByUserId" TEXT,
  "redeemedAt"       TIMESTAMP(3),
  "expiresAt"        TIMESTAMP(3),
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GiftCode_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "GiftCode_code_key"  ON "GiftCode"("code");
CREATE INDEX "GiftCode_code_idx"         ON "GiftCode"("code");
ALTER TABLE "GiftCode"
  ADD CONSTRAINT "GiftCode_redeemedByUserId_fkey" FOREIGN KEY ("redeemedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "LoyaltyPoint" (
  "id"         TEXT NOT NULL,
  "userId"     TEXT NOT NULL,
  "points"     INTEGER NOT NULL,
  "reason"     TEXT NOT NULL,
  "resourceId" TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LoyaltyPoint_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LoyaltyPoint_userId_idx"    ON "LoyaltyPoint"("userId");
CREATE INDEX "LoyaltyPoint_createdAt_idx" ON "LoyaltyPoint"("createdAt");
ALTER TABLE "LoyaltyPoint"
  ADD CONSTRAINT "LoyaltyPoint_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
