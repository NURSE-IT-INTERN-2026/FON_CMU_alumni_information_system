-- CreateTable
CREATE TABLE "table_column_widths" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tableKey" TEXT NOT NULL,
    "widths" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "table_column_widths_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "table_column_widths_userId_idx" ON "table_column_widths"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "table_column_widths_userId_tableKey_key" ON "table_column_widths"("userId", "tableKey");

-- AddForeignKey
ALTER TABLE "table_column_widths" ADD CONSTRAINT "table_column_widths_userId_fkey" FOREIGN KEY ("userId") REFERENCES "admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
