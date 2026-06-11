-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "mixedCarrier" BOOLEAN NOT NULL DEFAULT false,
    "originAirport" TEXT NOT NULL,
    "originCountry" TEXT NOT NULL,
    "departAt" TIMESTAMP(3) NOT NULL,
    "destAirport" TEXT NOT NULL,
    "destCountry" TEXT NOT NULL,
    "returnAt" TIMESTAMP(3) NOT NULL,
    "nights" INTEGER NOT NULL,
    "totalPrice" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PLN',
    "pricePerPerson" DOUBLE PRECISION NOT NULL,
    "outboundSource" TEXT NOT NULL,
    "outboundAirline" TEXT NOT NULL,
    "outboundPrice" DOUBLE PRECISION NOT NULL,
    "outboundFlightNo" TEXT,
    "outboundStops" INTEGER NOT NULL DEFAULT 0,
    "outboundBookingUrl" TEXT,
    "returnSource" TEXT NOT NULL,
    "returnAirline" TEXT NOT NULL,
    "returnPrice" DOUBLE PRECISION NOT NULL,
    "returnFlightNo" TEXT,
    "returnStops" INTEGER NOT NULL DEFAULT 0,
    "returnBookingUrl" TEXT,
    "foundAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SearchRun" (
    "id" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "dealsFound" INTEGER NOT NULL DEFAULT 0,
    "routesQueried" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,

    CONSTRAINT "SearchRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Deal_destCountry_totalPrice_idx" ON "Deal"("destCountry", "totalPrice");

-- CreateIndex
CREATE INDEX "Deal_expiresAt_idx" ON "Deal"("expiresAt");

-- CreateIndex
CREATE INDEX "Deal_departAt_idx" ON "Deal"("departAt");

-- CreateIndex
CREATE UNIQUE INDEX "Deal_originAirport_destAirport_departAt_returnAt_outboundSo_key" ON "Deal"("originAirport", "destAirport", "departAt", "returnAt", "outboundSource", "returnSource");

-- CreateIndex
CREATE INDEX "SearchRun_startedAt_idx" ON "SearchRun"("startedAt");
