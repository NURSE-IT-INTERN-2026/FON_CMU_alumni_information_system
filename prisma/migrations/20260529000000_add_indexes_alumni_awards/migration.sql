-- CreateIndex
CREATE INDEX "alumni_degreeLevel_idx" ON "alumni"("degreeLevel");

-- CreateIndex
CREATE INDEX "alumni_cohort_idx" ON "alumni"("cohort");

-- CreateIndex
CREATE INDEX "awards_awardType_idx" ON "awards"("awardType");

-- CreateIndex
CREATE INDEX "awards_year_idx" ON "awards"("year");
