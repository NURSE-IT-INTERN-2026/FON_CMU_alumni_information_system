-- DropTable
DROP TABLE IF EXISTS "association_members";

-- CreateTable
CREATE TABLE "associations" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "associationName" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "recordedYear" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "associations_pkey" PRIMARY KEY ("id")
);
