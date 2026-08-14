CREATE TABLE "AmbassadorProfile" (
  "id"           TEXT NOT NULL,
  "userId"       TEXT NOT NULL,
  "territory"    TEXT,
  "bio"          TEXT,
  "website"      TEXT,
  "phone"        TEXT,
  "referralCode" TEXT NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AmbassadorProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AmbassadorProfile_userId_key"    ON "AmbassadorProfile"("userId");
CREATE UNIQUE INDEX "AmbassadorProfile_referralCode_key" ON "AmbassadorProfile"("referralCode");

ALTER TABLE "AmbassadorProfile"
  ADD CONSTRAINT "AmbassadorProfile_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Referral" (
  "id"             TEXT NOT NULL,
  "ambassadorId"   TEXT NOT NULL,
  "referralCode"   TEXT NOT NULL,
  "referredUserId" TEXT,
  "convertedAt"    TIMESTAMP(3),
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Referral_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Referral_referredUserId_key" ON "Referral"("referredUserId");
CREATE INDEX "Referral_ambassadorId_idx"  ON "Referral"("ambassadorId");
CREATE INDEX "Referral_referralCode_idx"  ON "Referral"("referralCode");

ALTER TABLE "Referral"
  ADD CONSTRAINT "Referral_ambassadorId_fkey"
  FOREIGN KEY ("ambassadorId") REFERENCES "AmbassadorProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Referral"
  ADD CONSTRAINT "Referral_referredUserId_fkey"
  FOREIGN KEY ("referredUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
