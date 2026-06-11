-- Add open-jaw flag and return airport to Deal
ALTER TABLE "Deal" ADD COLUMN "openJaw" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Deal" ADD COLUMN "returnAirport" TEXT NOT NULL DEFAULT '';

-- Backfill: existing deals are classic round-trips, return airport = origin airport
UPDATE "Deal" SET "returnAirport" = "originAirport";

-- Drop old unique constraint (6 fields)
DROP INDEX "Deal_originAirport_destAirport_departAt_returnAt_outboundSo_key";

-- Create new unique constraint (7 fields, includes returnAirport)
CREATE UNIQUE INDEX "Deal_route_unique_key"
ON "Deal"("originAirport", "destAirport", "departAt", "returnAt", "outboundSource", "returnSource", "returnAirport");
