-- CreateTable
CREATE TABLE "OneWayFare" (
    "id" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "originCity" TEXT NOT NULL,
    "originCountry" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "destCity" TEXT NOT NULL,
    "destCountry" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "departureTime" TIMESTAMP(3) NOT NULL,
    "arrivalTime" TIMESTAMP(3) NOT NULL,
    "flightNumber" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PLN',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OneWayFare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OneWayFare_direction_price_idx" ON "OneWayFare"("direction", "price");

-- CreateIndex
CREATE INDEX "OneWayFare_direction_date_idx" ON "OneWayFare"("direction", "date");

-- CreateIndex
CREATE UNIQUE INDEX "OneWayFare_origin_destination_date_key" ON "OneWayFare"("origin", "destination", "date");

-- RenameIndex
ALTER INDEX "Deal_route_unique_key" RENAME TO "Deal_originAirport_destAirport_departAt_returnAt_outboundSo_key";

