CREATE TABLE "ProviderProfile" (
  "id"           TEXT         NOT NULL,
  "userId"       TEXT         NOT NULL,
  "businessName" TEXT,
  "specialty"    TEXT,
  "services"     TEXT,
  "website"      TEXT,
  "phone"        TEXT,
  "serviceArea"  TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ProviderProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProviderProfile_userId_key" ON "ProviderProfile"("userId");

ALTER TABLE "ProviderProfile" ADD CONSTRAINT "ProviderProfile_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
