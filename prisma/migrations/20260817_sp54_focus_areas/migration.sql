-- CreateEnum
CREATE TYPE "ContentDepth" AS ENUM ('QUICK', 'SHORT', 'DEEPER');

-- CreateTable
CREATE TABLE "FocusArea" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FocusArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberFocusArea" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "focusAreaId" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MemberFocusArea_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MemberPreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "contentDepth" "ContentDepth" NOT NULL DEFAULT 'SHORT',
    "contentFormats" TEXT[],
    "reminderEnabled" BOOLEAN NOT NULL DEFAULT true,
    "reminderTime" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MemberPreference_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FocusArea_name_key" ON "FocusArea"("name");
CREATE INDEX "FocusArea_order_idx" ON "FocusArea"("order");

-- CreateIndex
CREATE UNIQUE INDEX "MemberFocusArea_userId_focusAreaId_key" ON "MemberFocusArea"("userId", "focusAreaId");
CREATE INDEX "MemberFocusArea_userId_idx" ON "MemberFocusArea"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "MemberPreference_userId_key" ON "MemberPreference"("userId");

-- AddForeignKey
ALTER TABLE "MemberFocusArea" ADD CONSTRAINT "MemberFocusArea_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MemberFocusArea" ADD CONSTRAINT "MemberFocusArea_focusAreaId_fkey"
    FOREIGN KEY ("focusAreaId") REFERENCES "FocusArea"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MemberPreference" ADD CONSTRAINT "MemberPreference_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed: 14 built-in focus areas
INSERT INTO "FocusArea" ("id", "name", "order", "active", "createdAt", "updatedAt") VALUES
    ('fa_confidence',  'Confidence',           1,  true, NOW(), NOW()),
    ('fa_stress',      'Stress',               2,  true, NOW(), NOW()),
    ('fa_motivation',  'Motivation',           3,  true, NOW(), NOW()),
    ('fa_relation',    'Relationships',        4,  true, NOW(), NOW()),
    ('fa_career',      'Career',               5,  true, NOW(), NOW()),
    ('fa_purpose',     'Purpose',              6,  true, NOW(), NOW()),
    ('fa_financial',   'Financial well-being', 7,  true, NOW(), NOW()),
    ('fa_physical',    'Physical wellness',    8,  true, NOW(), NOW()),
    ('fa_mindful',     'Mindfulness',          9,  true, NOW(), NOW()),
    ('fa_social',      'Social connection',    10, true, NOW(), NOW()),
    ('fa_pgrowth',     'Personal growth',      11, true, NOW(), NOW()),
    ('fa_change',      'Change or transition', 12, true, NOW(), NOW()),
    ('fa_caregive',    'Caregiving',           13, true, NOW(), NOW()),
    ('fa_other',       'Other',                14, true, NOW(), NOW());
