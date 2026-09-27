-- SP-72: per-format book editions (Paperback / Hardcover / Digital-Kindle).
--
-- BookFormat.priceId is the owning side of the Price relation, matching how
-- BookOrder.priceId and UserMembership.priceId already point at the shared
-- Price model. ON DELETE SET NULL is deliberate: deleting a Price must leave
-- the format row standing (it falls back to Amazon-only), not cascade it away.

-- CreateEnum
CREATE TYPE "BookFormatType" AS ENUM ('PAPERBACK', 'HARDCOVER', 'DIGITAL');

-- CreateTable
CREATE TABLE "BookFormat" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "format" "BookFormatType" NOT NULL,
    "amazonUrl" TEXT,
    "priceId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BookFormat_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BookFormat_priceId_key" ON "BookFormat"("priceId");

-- CreateIndex
CREATE UNIQUE INDEX "BookFormat_productId_format_key" ON "BookFormat"("productId", "format");

-- CreateIndex
CREATE INDEX "BookFormat_productId_idx" ON "BookFormat"("productId");

-- AddForeignKey
ALTER TABLE "BookFormat" ADD CONSTRAINT "BookFormat_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookFormat" ADD CONSTRAINT "BookFormat_priceId_fkey"
    FOREIGN KEY ("priceId") REFERENCES "Price"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Data migration: the two Amazon links previously hardcoded in the BOOK_META
-- object (src/pages/books.tsx and src/pages/books/[slug].tsx) sat next to an
-- "Also on Amazon Kindle" label, so they are DIGITAL-format links. Carried
-- over verbatim — the placeholder https://www.amazon.com values are what
-- production shows today; correcting them is a content task, not this one.
-- Books with no Amazon link today (think-with-5-brains, how-to-lie) get no
-- rows: an admin populates them through the new Formats UI.
-- Idempotent — safe to re-run.
INSERT INTO "BookFormat" ("id", "productId", "format", "amazonUrl", "sortOrder", "createdAt", "updatedAt")
SELECT
    'bkfmt_digital_' || p."id",
    p."id",
    'DIGITAL'::"BookFormatType",
    'https://www.amazon.com',
    30,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Product" p
WHERE p."type" = 'BOOK'
  AND p."slug" IN ('kill-the-bully', 'your-past-doesnt-define-you')
ON CONFLICT ("productId", "format") DO NOTHING;
