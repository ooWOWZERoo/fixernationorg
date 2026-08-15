-- SP-4: Affiliate Integration
-- AffiliateAssignment, PromoCode, CommissionRule, CommissionLedger + 4 enums

-- ── Enums ─────────────────────────────────────────────────────────────────────

CREATE TYPE "AffiliateStatus" AS ENUM ('PENDING', 'ACTIVE', 'ON_HOLD', 'SUSPENDED', 'REVOKED', 'CLOSED');
CREATE TYPE "CommissionType" AS ENUM ('PERCENTAGE', 'FLAT');
CREATE TYPE "CommissionLedgerStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID', 'REVERSED', 'ON_HOLD', 'CANCELLED');
CREATE TYPE "PromoCodeStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'EXPIRED');

-- ── AffiliateAssignment ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "AffiliateAssignment" (
  "id"                   TEXT NOT NULL,
  "userId"               TEXT NOT NULL,
  "applicationId"        TEXT,
  "affiliateType"        TEXT NOT NULL,
  "status"               "AffiliateStatus" NOT NULL DEFAULT 'PENDING',
  "attributionWindowDays" INTEGER NOT NULL DEFAULT 30,
  "payoutThreshold"      DECIMAL(10,2),
  "payoutCycle"          TEXT NOT NULL DEFAULT 'MONTHLY',
  "taxOnboardingDone"    BOOLEAN NOT NULL DEFAULT false,
  "payoutOnboardingDone" BOOLEAN NOT NULL DEFAULT false,
  "stripeConnectId"      TEXT,
  "activatedAt"          TIMESTAMP(3),
  "suspendedAt"          TIMESTAMP(3),
  "suspendedReason"      TEXT,
  "revokedAt"            TIMESTAMP(3),
  "revokedBy"            TEXT,
  "notes"                TEXT,
  "assignedBy"           TEXT NOT NULL,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AffiliateAssignment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AffiliateAssignment_applicationId_key" UNIQUE ("applicationId"),
  CONSTRAINT "AffiliateAssignment_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "AffiliateAssignment_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "UserApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "AffiliateAssignment_userId_idx"  ON "AffiliateAssignment"("userId");
CREATE INDEX IF NOT EXISTS "AffiliateAssignment_status_idx"  ON "AffiliateAssignment"("status");

-- ── PromoCode ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "PromoCode" (
  "id"            TEXT NOT NULL,
  "code"          TEXT NOT NULL,
  "affiliateId"   TEXT NOT NULL,
  "status"        "PromoCodeStatus" NOT NULL DEFAULT 'ACTIVE',
  "discountType"  TEXT NOT NULL DEFAULT 'PERCENTAGE',
  "discountValue" DECIMAL(10,2) NOT NULL,
  "maxUses"       INTEGER,
  "usedCount"     INTEGER NOT NULL DEFAULT 0,
  "validFrom"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "validUntil"    TIMESTAMP(3),
  "notes"         TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PromoCode_code_key" UNIQUE ("code"),
  CONSTRAINT "PromoCode_affiliateId_fkey"
    FOREIGN KEY ("affiliateId") REFERENCES "AffiliateAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "PromoCode_code_idx"        ON "PromoCode"("code");
CREATE INDEX IF NOT EXISTS "PromoCode_affiliateId_idx" ON "PromoCode"("affiliateId");

-- ── CommissionRule ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "CommissionRule" (
  "id"          TEXT NOT NULL,
  "affiliateId" TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "type"        "CommissionType" NOT NULL DEFAULT 'PERCENTAGE',
  "rate"        DECIMAL(8,4) NOT NULL,
  "pendingDays" INTEGER NOT NULL DEFAULT 30,
  "appliesTo"   TEXT,
  "active"      BOOLEAN NOT NULL DEFAULT true,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommissionRule_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CommissionRule_affiliateId_fkey"
    FOREIGN KEY ("affiliateId") REFERENCES "AffiliateAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "CommissionRule_affiliateId_idx" ON "CommissionRule"("affiliateId");

-- ── CommissionLedger ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "CommissionLedger" (
  "id"               TEXT NOT NULL,
  "affiliateId"      TEXT NOT NULL,
  "status"           "CommissionLedgerStatus" NOT NULL DEFAULT 'PENDING',
  "sourceType"       TEXT NOT NULL,
  "sourceRef"        TEXT,
  "description"      TEXT,
  "grossAmount"      DECIMAL(10,2) NOT NULL,
  "commissionRate"   DECIMAL(8,4),
  "commissionAmount" DECIMAL(10,2) NOT NULL,
  "currency"         TEXT NOT NULL DEFAULT 'USD',
  "pendingUntil"     TIMESTAMP(3),
  "approvedAt"       TIMESTAMP(3),
  "approvedBy"       TEXT,
  "paidAt"           TIMESTAMP(3),
  "payoutBatchId"    TEXT,
  "reversedAt"       TIMESTAMP(3),
  "reversedBy"       TEXT,
  "reversalReason"   TEXT,
  "notes"            TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CommissionLedger_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CommissionLedger_affiliateId_fkey"
    FOREIGN KEY ("affiliateId") REFERENCES "AffiliateAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "CommissionLedger_affiliateId_idx"  ON "CommissionLedger"("affiliateId");
CREATE INDEX IF NOT EXISTS "CommissionLedger_status_idx"       ON "CommissionLedger"("status");
CREATE INDEX IF NOT EXISTS "CommissionLedger_pendingUntil_idx" ON "CommissionLedger"("pendingUntil");
