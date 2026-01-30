-- Add scoring and moderation fields to Feed table
ALTER TABLE "feeds" ADD COLUMN "sourceAuthorityScore" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "feeds" ADD COLUMN "recencyScore" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "feeds" ADD COLUMN "metadataScore" INTEGER NOT NULL DEFAULT 0;

-- AI moderation scores (from Llama Guard)
ALTER TABLE "feeds" ADD COLUMN "moderationScore" DOUBLE PRECISION;
ALTER TABLE "feeds" ADD COLUMN "moderationCategory" TEXT;
ALTER TABLE "feeds" ADD COLUMN "moderationReasoning" TEXT;

-- Overall quality score
ALTER TABLE "feeds" ADD COLUMN "qualityScore" INTEGER NOT NULL DEFAULT 0;

-- Moderation flags
ALTER TABLE "feeds" ADD COLUMN "isSafe" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "feeds" ADD COLUMN "isSalesContent" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "feeds" ADD COLUMN "hasPromoCodes" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "feeds" ADD COLUMN "isClickbait" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "feeds" ADD COLUMN "isTrending" BOOLEAN NOT NULL DEFAULT false;

-- Auto-decision tracking
ALTER TABLE "feeds" ADD COLUMN "autoApproved" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "feeds" ADD COLUMN "autoRejected" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "feeds" ADD COLUMN "scoredAt" TIMESTAMP(3);

-- Add index for efficient querying
CREATE INDEX "feeds_qualityScore_idx" ON "feeds"("qualityScore");
CREATE INDEX "feeds_isSafe_idx" ON "feeds"("isSafe");
CREATE INDEX "feeds_autoApproved_idx" ON "feeds"("autoApproved");
CREATE INDEX "feeds_scoredAt_idx" ON "feeds"("scoredAt");

-- Update RssFeed table for source tracking
ALTER TABLE "rss_feeds" ADD COLUMN "authorityScore" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "rss_feeds" ADD COLUMN "totalProcessed" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "rss_feeds" ADD COLUMN "totalApproved" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "rss_feeds" ADD COLUMN "approvalRate" DOUBLE PRECISION;
