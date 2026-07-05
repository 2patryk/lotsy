-- AlterTable: record which carrier won the cheapest fare for each route+day
ALTER TABLE "OneWayFare" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'RYANAIR';
ALTER TABLE "OneWayFare" ADD COLUMN "airline" TEXT NOT NULL DEFAULT 'Ryanair';
