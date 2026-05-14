-- CreateTable
CREATE TABLE "potentials" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "career" TEXT NOT NULL,
    "position" TEXT NOT NULL,
    "recordedYear" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "potentials_pkey" PRIMARY KEY ("id")
);
