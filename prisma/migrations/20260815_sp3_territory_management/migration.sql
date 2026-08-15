-- SP-3: Territory Management
-- Territory + TerritoryAssignment models, 4 new enums

-- ── Enums ─────────────────────────────────────────────────────────────────────

CREATE TYPE "TerritoryType" AS ENUM ('GEOGRAPHIC', 'INDUSTRY', 'ORGANIZATION', 'CUSTOM');
CREATE TYPE "TerritoryScope" AS ENUM ('ZIP', 'CITY', 'COUNTY', 'STATE', 'REGION', 'NATIONAL', 'CUSTOM');
CREATE TYPE "TerritoryStatus" AS ENUM ('ACTIVE', 'RESERVED', 'LOCKED', 'INACTIVE');
CREATE TYPE "TerritoryAssignmentStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'REVOKED', 'TRANSFERRED');

-- ── Territory ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "Territory" (
  "id"          TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "type"        "TerritoryType" NOT NULL DEFAULT 'GEOGRAPHIC',
  "scope"       "TerritoryScope" NOT NULL DEFAULT 'COUNTY',
  "county"      TEXT,
  "city"        TEXT,
  "state"       TEXT,
  "zip"         TEXT,
  "region"      TEXT,
  "description" TEXT,
  "status"      "TerritoryStatus" NOT NULL DEFAULT 'ACTIVE',
  "isExclusive" BOOLEAN NOT NULL DEFAULT false,
  "notes"       TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Territory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "Territory_status_idx"       ON "Territory"("status");
CREATE INDEX IF NOT EXISTS "Territory_scope_state_idx"  ON "Territory"("scope", "state");

-- ── TerritoryAssignment ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS "TerritoryAssignment" (
  "id"            TEXT NOT NULL,
  "territoryId"   TEXT NOT NULL,
  "userId"        TEXT,
  "applicationId" TEXT,
  "status"        "TerritoryAssignmentStatus" NOT NULL DEFAULT 'ACTIVE',
  "startDate"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endDate"       TIMESTAMP(3),
  "autoRenew"     BOOLEAN NOT NULL DEFAULT true,
  "notes"         TEXT,
  "assignedBy"    TEXT NOT NULL,
  "revokedAt"     TIMESTAMP(3),
  "revokedBy"     TEXT,
  "transferredTo" TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TerritoryAssignment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TerritoryAssignment_territoryId_fkey"
    FOREIGN KEY ("territoryId") REFERENCES "Territory"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "TerritoryAssignment_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "TerritoryAssignment_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "UserApplication"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "TerritoryAssignment_userId_idx"        ON "TerritoryAssignment"("userId");
CREATE INDEX IF NOT EXISTS "TerritoryAssignment_territoryId_idx"   ON "TerritoryAssignment"("territoryId");
CREATE INDEX IF NOT EXISTS "TerritoryAssignment_applicationId_idx" ON "TerritoryAssignment"("applicationId");
CREATE INDEX IF NOT EXISTS "TerritoryAssignment_status_idx"        ON "TerritoryAssignment"("status");
