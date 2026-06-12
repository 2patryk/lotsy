CREATE TABLE "RouteCache" (
    "id" TEXT NOT NULL,
    "savedAt" TIMESTAMP(3) NOT NULL,
    "routes" JSONB NOT NULL,
    "destMap" JSONB NOT NULL,
    CONSTRAINT "RouteCache_pkey" PRIMARY KEY ("id")
);
