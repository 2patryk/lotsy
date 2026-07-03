-- AlterTable
ALTER TABLE "CharterFlight" ADD COLUMN "returnDate" TIMESTAMP(3),
ADD COLUMN "retDepTime" TEXT,
ADD COLUMN "retArrTime" TEXT,
ADD COLUMN "retArrIata" TEXT,
ADD COLUMN "retArrAirport" TEXT,
ADD COLUMN "retAirline" TEXT,
ADD COLUMN "retFlightNo" TEXT,
ADD COLUMN "returnPrice" DOUBLE PRECISION,
ADD COLUMN "retPakietId" TEXT,
ADD COLUMN "nights" INTEGER,
ADD COLUMN "totalPrice" DOUBLE PRECISION;

-- CreateIndex
CREATE INDEX "CharterFlight_oneWay_totalPrice_idx" ON "CharterFlight"("oneWay", "totalPrice");
