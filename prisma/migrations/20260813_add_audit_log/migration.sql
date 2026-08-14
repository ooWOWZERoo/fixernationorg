CREATE TABLE "AuditLog" (
    "id"         TEXT NOT NULL,
    "actorId"    TEXT,
    "actorEmail" TEXT,
    "action"     TEXT NOT NULL,
    "resource"   TEXT NOT NULL,
    "resourceId" TEXT,
    "metadata"   JSONB,
    "ip"         TEXT,
    "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AuditLog_actorId_idx"  ON "AuditLog"("actorId");
CREATE INDEX "AuditLog_action_idx"   ON "AuditLog"("action");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
