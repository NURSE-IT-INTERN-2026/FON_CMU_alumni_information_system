-- CreateEnum
CREATE TYPE "GroupKind" AS ENUM ('COHORT', 'INTEREST');

-- CreateEnum
CREATE TYPE "GroupRole" AS ENUM ('MEMBER', 'MODERATOR');

-- AlterTable
ALTER TABLE "community_events" ADD COLUMN     "groupId" TEXT;

-- AlterTable
ALTER TABLE "forum_topics" ADD COLUMN     "groupId" TEXT;

-- CreateTable
CREATE TABLE "community_groups" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "kind" "GroupKind" NOT NULL,
    "cohortKey" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "coverImageUrl" TEXT,
    "memberCount" INTEGER NOT NULL DEFAULT 0,
    "topicCount" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "community_groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_memberships" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "alumniId" TEXT NOT NULL,
    "role" "GroupRole" NOT NULL DEFAULT 'MEMBER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "group_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "community_groups_slug_key" ON "community_groups"("slug");

-- CreateIndex
CREATE INDEX "community_groups_kind_idx" ON "community_groups"("kind");

-- CreateIndex
CREATE INDEX "group_memberships_alumniId_idx" ON "group_memberships"("alumniId");

-- CreateIndex
CREATE UNIQUE INDEX "group_memberships_groupId_alumniId_key" ON "group_memberships"("groupId", "alumniId");

-- CreateIndex
CREATE INDEX "community_events_groupId_idx" ON "community_events"("groupId");

-- CreateIndex
CREATE INDEX "forum_topics_groupId_idx" ON "forum_topics"("groupId");

-- AddForeignKey
ALTER TABLE "forum_topics" ADD CONSTRAINT "forum_topics_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "community_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "community_events" ADD CONSTRAINT "community_events_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "community_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "community_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_memberships" ADD CONSTRAINT "group_memberships_alumniId_fkey" FOREIGN KEY ("alumniId") REFERENCES "alumni"("id") ON DELETE CASCADE ON UPDATE CASCADE;
