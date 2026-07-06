-- CreateTable
CREATE TABLE "OneWayPriceHistory" (
    "id" SERIAL NOT NULL,
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "source" TEXT NOT NULL,
    "airline" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OneWayPriceHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OneWayPriceHistory_origin_destination_date_idx" ON "OneWayPriceHistory"("origin", "destination", "date");

-- CreateIndex
CREATE INDEX "OneWayPriceHistory_date_idx" ON "OneWayPriceHistory"("date");
