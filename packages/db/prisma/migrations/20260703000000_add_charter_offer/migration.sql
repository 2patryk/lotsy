-- CreateTable
CREATE TABLE "CharterOffer" (
    "destIata" TEXT NOT NULL,
    "destName" TEXT NOT NULL,
    "destNameUrl" TEXT NOT NULL,
    "destCountry" TEXT NOT NULL,
    "destCountryUrl" TEXT NOT NULL,
    "priceRoundTrip" DOUBLE PRECISION,
    "priceOneWay" DOUBLE PRECISION,
    "nearestDeparture" TIMESTAMP(3),
    "baggageKg" INTEGER,
    "imageUrl" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharterOffer_pkey" PRIMARY KEY ("destIata")
);

-- CreateIndex
CREATE INDEX "CharterOffer_priceRoundTrip_idx" ON "CharterOffer"("priceRoundTrip");
