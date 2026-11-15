CREATE TABLE "DemoPayment" (
  "id" UUID NOT NULL,
  "transactionId" UUID NOT NULL,
  "payerId" UUID NOT NULL,
  "receiverId" UUID NOT NULL,
  "amountIdr" BIGINT NOT NULL,
  "method" VARCHAR(12) NOT NULL DEFAULT 'QRIS',
  "mode" VARCHAR(12) NOT NULL DEFAULT 'DEMO',
  "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DemoPayment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DemoPayment_demo_only" CHECK ("mode" = 'DEMO' AND "method" = 'QRIS' AND "amountIdr" > 0)
);
CREATE UNIQUE INDEX "DemoPayment_transactionId_key" ON "DemoPayment"("transactionId");
ALTER TABLE "DemoPayment" ADD CONSTRAINT "DemoPayment_transactionId_fkey"
  FOREIGN KEY ("transactionId") REFERENCES "Transaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
