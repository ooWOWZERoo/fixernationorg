-- SP-34: Suppression Record

CREATE TYPE "SuppressionType" AS ENUM ('BOUNCE', 'COMPLAINT', 'UNSUBSCRIBE', 'ADMIN');

CREATE TABLE "SuppressionRecord" (
    "id"           TEXT NOT NULL,
    "email"        TEXT NOT NULL,
    "type"         "SuppressionType" NOT NULL,
    "reason"       TEXT,
    "source"       TEXT,
    "suppressedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "liftedAt"     TIMESTAMP(3),
    "liftedBy"     TEXT,

    CONSTRAINT "SuppressionRecord_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SuppressionRecord_email_idx" ON "SuppressionRecord"("email");
CREATE INDEX "SuppressionRecord_type_idx"  ON "SuppressionRecord"("type");
