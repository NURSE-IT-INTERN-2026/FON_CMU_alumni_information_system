-- CreateTable
CREATE TABLE "community_profiles" (
    "id" TEXT NOT NULL,
    "alumniId" TEXT NOT NULL,
    "photoUrl" TEXT,
    "currentWorkplace" TEXT,
    "currentPosition" TEXT,
    "province" TEXT,
    "country" TEXT,
    "bio" TEXT,
    "contactEmail" TEXT,
    "facebookUrl" TEXT,
    "lineId" TEXT,
    "linkedinUrl" TEXT,
    "otherLink" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "community_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "community_profiles_alumniId_key" ON "community_profiles"("alumniId");

-- CreateIndex
CREATE INDEX "community_profiles_province_idx" ON "community_profiles"("province");

-- CreateIndex
CREATE INDEX "community_profiles_country_idx" ON "community_profiles"("country");

-- AddForeignKey
ALTER TABLE "community_profiles" ADD CONSTRAINT "community_profiles_alumniId_fkey" FOREIGN KEY ("alumniId") REFERENCES "alumni"("id") ON DELETE CASCADE ON UPDATE CASCADE;
