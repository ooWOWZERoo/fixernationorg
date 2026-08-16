-- SP-40: ContactImportBatch
CREATE TABLE "ContactImportBatch" (
  "id"                   TEXT NOT NULL,
  "filename"             TEXT,
  "totalRows"            INTEGER NOT NULL,
  "created"              INTEGER NOT NULL DEFAULT 0,
  "existing"             INTEGER NOT NULL DEFAULT 0,
  "consentAdded"         INTEGER NOT NULL DEFAULT 0,
  "addressesCreated"     INTEGER NOT NULL DEFAULT 0,
  "listMembershipsAdded" INTEGER NOT NULL DEFAULT 0,
  "importedBy"           TEXT,
  "importedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ContactImportBatch_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ContactImportBatch_importedAt_idx" ON "ContactImportBatch"("importedAt");
