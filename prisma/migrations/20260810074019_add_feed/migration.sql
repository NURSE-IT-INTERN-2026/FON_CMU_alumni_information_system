-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ForumReportResource" ADD VALUE 'FEED_POST';
ALTER TYPE "ForumReportResource" ADD VALUE 'FEED_COMMENT';

-- CreateTable
CREATE TABLE "feed_posts" (
    "id" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "imageUrl" TEXT,
    "likeCount" INTEGER NOT NULL DEFAULT 0,
    "commentCount" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feed_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feed_likes" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "alumniId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "feed_likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "feed_comments" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "feed_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "feed_posts_authorId_idx" ON "feed_posts"("authorId");

-- CreateIndex
CREATE INDEX "feed_posts_deletedAt_createdAt_idx" ON "feed_posts"("deletedAt", "createdAt");

-- CreateIndex
CREATE INDEX "feed_likes_postId_idx" ON "feed_likes"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "feed_likes_postId_alumniId_key" ON "feed_likes"("postId", "alumniId");

-- CreateIndex
CREATE INDEX "feed_comments_postId_createdAt_idx" ON "feed_comments"("postId", "createdAt");

-- AddForeignKey
ALTER TABLE "feed_posts" ADD CONSTRAINT "feed_posts_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "alumni"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_likes" ADD CONSTRAINT "feed_likes_postId_fkey" FOREIGN KEY ("postId") REFERENCES "feed_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_likes" ADD CONSTRAINT "feed_likes_alumniId_fkey" FOREIGN KEY ("alumniId") REFERENCES "alumni"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_comments" ADD CONSTRAINT "feed_comments_postId_fkey" FOREIGN KEY ("postId") REFERENCES "feed_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "feed_comments" ADD CONSTRAINT "feed_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "alumni"("id") ON DELETE CASCADE ON UPDATE CASCADE;
