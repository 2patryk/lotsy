CREATE TABLE "Airport" (
    "iata"     TEXT    NOT NULL,
    "name"     TEXT    NOT NULL,
    "country"  TEXT    NOT NULL,
    "isPolish" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "Airport_pkey" PRIMARY KEY ("iata")
);

CREATE TABLE "AirportRoute" (
    "fromIata" TEXT NOT NULL,
    "toIata"   TEXT NOT NULL,
    CONSTRAINT "AirportRoute_pkey" PRIMARY KEY ("fromIata","toIata")
);

CREATE INDEX "AirportRoute_fromIata_idx" ON "AirportRoute"("fromIata");

CREATE TABLE "AirportSync" (
    "id"       TEXT      NOT NULL,
    "syncedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AirportSync_pkey" PRIMARY KEY ("id")
);
