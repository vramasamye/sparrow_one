-- AlterTable: Add platform configuration to topics
ALTER TABLE "topics" ADD COLUMN "enableTwitter" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "topics" ADD COLUMN "enableLinkedin" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable: Make generated post content nullable
ALTER TABLE "generated_posts" ALTER COLUMN "twitterContent" DROP NOT NULL;
ALTER TABLE "generated_posts" ALTER COLUMN "linkedinContent" DROP NOT NULL;

-- Add constraint comment (enforced at application level)
COMMENT ON COLUMN "topics"."enableTwitter" IS 'Whether Twitter posts should be generated for this topic';
COMMENT ON COLUMN "topics"."enableLinkedin" IS 'Whether LinkedIn posts should be generated for this topic';
