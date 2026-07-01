-- CreateTable
CREATE TABLE "cmu_graduates" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "nameTh" TEXT NOT NULL,
    "surnameTh" TEXT NOT NULL,
    "birthday" TEXT NOT NULL,
    "levelId" TEXT NOT NULL,
    "majorNameTh" TEXT NOT NULL,
    "gradYear" TEXT NOT NULL,
    "sexId" TEXT,
    "cmuitAccount" TEXT,
    "nameEn" TEXT,
    "surnameEn" TEXT,
    "gradDate" TEXT,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cmu_graduates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cmu_graduates_studentId_key" ON "cmu_graduates"("studentId");

-- CreateIndex
CREATE INDEX "cmu_graduates_levelId_idx" ON "cmu_graduates"("levelId");

-- CreateIndex
CREATE INDEX "cmu_graduates_gradYear_idx" ON "cmu_graduates"("gradYear");

-- CreateIndex
CREATE INDEX "cmu_graduates_majorNameTh_idx" ON "cmu_graduates"("majorNameTh");

-- CreateIndex
CREATE INDEX "cmu_graduates_deletedAt_idx" ON "cmu_graduates"("deletedAt");
