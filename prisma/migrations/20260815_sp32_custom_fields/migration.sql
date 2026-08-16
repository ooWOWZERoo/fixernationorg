-- SP-32: Custom Fields

CREATE TYPE "CustomFieldType" AS ENUM ('TEXT', 'NUMBER', 'DATE', 'DROPDOWN', 'CHECKBOX', 'URL', 'TEXTAREA');

CREATE TABLE "CustomFieldDefinition" (
    "id"        TEXT NOT NULL,
    "slug"      TEXT NOT NULL,
    "label"     TEXT NOT NULL,
    "type"      "CustomFieldType" NOT NULL,
    "options"   JSONB,
    "required"  BOOLEAN NOT NULL DEFAULT false,
    "active"    BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomFieldDefinition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomFieldDefinition_slug_key" ON "CustomFieldDefinition"("slug");
CREATE INDEX "CustomFieldDefinition_active_idx" ON "CustomFieldDefinition"("active");

CREATE TABLE "CustomFieldValue" (
    "id"        TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "fieldId"   TEXT NOT NULL,
    "value"     TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomFieldValue_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CustomFieldValue_contactId_fieldId_key" ON "CustomFieldValue"("contactId", "fieldId");
CREATE INDEX "CustomFieldValue_fieldId_idx" ON "CustomFieldValue"("fieldId");

ALTER TABLE "CustomFieldValue" ADD CONSTRAINT "CustomFieldValue_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CustomFieldValue" ADD CONSTRAINT "CustomFieldValue_fieldId_fkey"
    FOREIGN KEY ("fieldId") REFERENCES "CustomFieldDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
