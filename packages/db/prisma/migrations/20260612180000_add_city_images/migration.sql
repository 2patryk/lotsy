CREATE TABLE "CityImage" (
  "city"     TEXT NOT NULL,
  "imageUrl" TEXT NOT NULL,
  "cachedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CityImage_pkey" PRIMARY KEY ("city")
);
