-- CreateEnum
CREATE TYPE "BookOrderStatus" AS ENUM ('PENDING', 'PAID', 'SHIPPED', 'DELIVERED', 'CANCELED');

-- CreateTable
CREATE TABLE "BookOrder" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "priceId" TEXT NOT NULL,
    "status" "BookOrderStatus" NOT NULL DEFAULT 'PENDING',
    "stripeCheckoutSessionId" TEXT NOT NULL,
    "amountPaid" INTEGER,
    "shippingName" TEXT,
    "shippingAddressLine1" TEXT,
    "shippingAddressLine2" TEXT,
    "shippingCity" TEXT,
    "shippingState" TEXT,
    "shippingPostalCode" TEXT,
    "shippingCountry" TEXT,
    "shippedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "BookOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BookOrder_stripeCheckoutSessionId_key" ON "BookOrder"("stripeCheckoutSessionId");

-- CreateIndex
CREATE INDEX "BookOrder_userId_idx" ON "BookOrder"("userId");

-- CreateIndex
CREATE INDEX "BookOrder_status_idx" ON "BookOrder"("status");

-- AddForeignKey
ALTER TABLE "BookOrder" ADD CONSTRAINT "BookOrder_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookOrder" ADD CONSTRAINT "BookOrder_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookOrder" ADD CONSTRAINT "BookOrder_priceId_fkey"
    FOREIGN KEY ("priceId") REFERENCES "Price"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterEnum
-- Must run as its own statement — cannot be batched with other DDL that
-- might reference the new value in the same transaction.
ALTER TYPE "AutomationTrigger" ADD VALUE 'BOOK_PURCHASED';
