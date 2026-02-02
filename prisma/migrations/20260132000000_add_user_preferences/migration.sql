-- Add UserPreferences table
CREATE TABLE "user_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "twitterTimes" JSONB NOT NULL DEFAULT '[8, 10, 12, 14, 17, 19]',
    "linkedinTimes" JSONB NOT NULL DEFAULT '[9, 11, 13, 16, 18, 20]',
    "postsPerWeek" INTEGER NOT NULL DEFAULT 7,
    "activeDays" JSONB NOT NULL DEFAULT '[1, 2, 3, 4, 5]',
    "quietStart" INTEGER,
    "quietEnd" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

-- Add unique constraint on userId
CREATE UNIQUE INDEX "user_preferences_userId_key" ON "user_preferences"("userId");

-- Add foreign key constraint
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create default preferences for existing users
INSERT INTO "user_preferences" ("id", "userId", "timezone", "twitterTimes", "linkedinTimes", "postsPerWeek", "activeDays", "createdAt", "updatedAt")
SELECT
    gen_random_uuid()::text,
    id,
    'UTC',
    '[8, 10, 12, 14, 17, 19]'::jsonb,
    '[9, 11, 13, 16, 18, 20]'::jsonb,
    7,
    '[1, 2, 3, 4, 5]'::jsonb,
    NOW(),
    NOW()
FROM "users"
WHERE id NOT IN (SELECT "userId" FROM "user_preferences");
