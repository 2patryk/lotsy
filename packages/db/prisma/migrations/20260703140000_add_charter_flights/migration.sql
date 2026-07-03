-- CreateTable
CREATE TABLE "CharterFlight" (
    "id" TEXT NOT NULL,
    "oneWay" BOOLEAN NOT NULL,
    "destIata" TEXT NOT NULL,
    "destName" TEXT NOT NULL,
    "destNameUrl" TEXT NOT NULL,
    "destCountry" TEXT NOT NULL,
    "destCountryUrl" TEXT NOT NULL,
    "imageUrl" TEXT,
    "date" TIMESTAMP(3) NOT NULL,
    "depTime" TEXT NOT NULL,
    "arrTime" TEXT NOT NULL,
    "depIata" TEXT NOT NULL,
    "depAirport" TEXT NOT NULL,
    "airline" TEXT NOT NULL,
    "flightNo" TEXT,
    "flightTime" TEXT,
    "baggageKg" INTEGER,
    "price" DOUBLE PRECISION NOT NULL,
    "pakietId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharterFlight_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CharterFlight_oneWay_price_idx" ON "CharterFlight"("oneWay", "price");

-- CreateIndex
CREATE INDEX "CharterFlight_destCountry_idx" ON "CharterFlight"("destCountry");

-- CreateIndex
CREATE INDEX "CharterFlight_depIata_idx" ON "CharterFlight"("depIata");

-- CreateIndex
CREATE INDEX "CharterFlight_date_idx" ON "CharterFlight"("date");
