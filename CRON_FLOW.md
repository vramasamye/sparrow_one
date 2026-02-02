# Complete CRON Flow Documentation

## Overview
The platform uses a series of CRON jobs to automate the entire content pipeline from RSS feeds to social media posts.

## 🔄 Complete Pipeline

```
RSS Feeds → Scoring → Queue → Generation → Distribution → Publishing
```

## CRON Jobs

### 1. `/api/cron/process-feeds` - Fetch RSS Content
**Schedule:** Every 2 hours
**Function:** `processAllFeeds()`

**Flow:**
1. Gets topics with active subscribers (to avoid fetching unused feeds)
2. Fetches RSS feeds for those topics
3. Parses and stores new feed items
4. Automatically scores and queues approved feeds

**Location:** `src/lib/feed-processor.ts`

**Key Features:**
- Time-based filtering (only new articles)
- Duplicate detection via content hash
- Batch processing (5 feeds at a time)
- Auto-scoring and auto-queueing

---

### 2. `/api/cron/process-queue` - Generate Posts
**Schedule:** Every 15 minutes
**Function:** `dequeueNextJob()` → `generatePostsForFeed()` → `distributeToSubscribers()`

**Flow:**
1. **Dequeue:** Pick next approved feed from queue
2. **Generate:** Create Twitter + LinkedIn posts using GROQ AI
3. **Distribute:** Schedule posts for all subscribers based on their preferences

**Location:** `src/lib/queue.ts`, `src/lib/auto-generator.ts`, `src/lib/auto-scheduler.ts`

**Key Features:**
- Processes ONE job per run (Vercel timeout limits)
- Rate limit handling (waits for available API key)
- Automatic retry for stuck jobs
- Natural scheduling with user preferences (timezone-aware)

**Distribution Methods:**
- **Natural Scheduling (Default):** Uses `user_preferences` table
  - Respects user timezone
  - Posts at user-defined optimal times
  - Limits: 6 posts/day per platform, customizable posts/week
- **Legacy Scheduling:** Fallback UTC-based scheduling if preferences don't exist

---

### 3. `/api/cron/publish-posts` - Publish to Social Media
**Schedule:** Every 1 minute
**Function:** `publishScheduledPosts()`

**Flow:**
1. Find posts scheduled for NOW (within current minute)
2. Process up to 10 posts per run
3. Check token expiry and refresh if needed
4. Publish to Twitter/LinkedIn APIs
5. Update status and save to history

**Location:** `src/lib/social-publisher.ts`

**Key Features:**
- Sequential processing per user (avoids rate limits)
- Automatic token refresh
- 1-second delay between posts
- Failure tracking with retry count

---

### 4. `/api/cron/refresh-tokens` - Keep OAuth Tokens Fresh
**Schedule:** Every 6 hours
**Function:** `refreshExpiringTokens()`

**Flow:**
1. Find tokens expiring within 7 days
2. Use refresh_token to get new access_token
3. Update stored tokens in database

**Location:** `src/lib/token-refresh.ts`

---

### 5. `/api/cron/cleanup` - Database Maintenance
**Schedule:** Daily at 3 AM UTC
**Function:** `runAllCleanupJobs()`

**Flow:**
1. Delete pending feeds older than 24 hours
2. Clean up failed jobs older than 7 days
3. Archive published posts older than 30 days

**Location:** `src/lib/cleanup.ts`

---

### 6. `/api/cron/master` - All-in-One (Optional)
**Schedule:** Once per day
**Function:** Runs all above tasks sequentially

This is useful for simpler deployments but not recommended for production due to timeout limits.

---

## 🔍 Verification Commands

### Check Queue Status
```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://your-app.vercel.app/api/cron/manage
```

### Trigger Manual Processing
```bash
# Process queue once
curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://your-app.vercel.app/api/cron/process-queue

# Publish pending posts
curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://your-app.vercel.app/api/cron/publish-posts
```

### Check Database
```bash
# Verify scheduled posts exist
PRODUCTION_DATABASE_URL="..." npx tsx scripts/verify-scheduled-posts.ts
```

---

## 🐛 Common Issues & Solutions

### Issue 1: "user_preferences table does not exist"
**Cause:** Prisma client not regenerated after migration

**Solution:**
```bash
npx prisma generate
git push origin main  # Vercel auto-deploys with updated client
```

### Issue 2: Posts generated but not scheduled
**Cause:** No subscribers for the topic OR distribution failed

**Check:**
1. Verify users are subscribed to topics: `SELECT * FROM user_topics`
2. Check social accounts: `SELECT * FROM social_accounts WHERE isActive = true`
3. Review logs for distribution errors

### Issue 3: Posts scheduled but not publishing
**Cause:** Token expired, rate limit, or API error

**Check:**
1. Token status: `SELECT * FROM social_accounts WHERE tokenExpiresAt < NOW()`
2. Review `scheduled_posts` table for error messages
3. Check publish-posts cron logs

### Issue 4: Feeds not being processed
**Cause:** No subscribers for any topics

**Solution:**
- Ensure at least one user is subscribed to a topic via `user_topics` table

---

## 📊 Database Queries for Monitoring

```sql
-- Check queue status
SELECT status, COUNT(*) FROM generated_posts GROUP BY status;

-- Check scheduled posts by platform
SELECT platform, status, COUNT(*) FROM scheduled_posts GROUP BY platform, status;

-- Check user subscriptions
SELECT t.name, COUNT(ut."userId") as subscribers
FROM topics t
LEFT JOIN user_topics ut ON t.id = ut."topicId"
GROUP BY t.id, t.name;

-- Recent published posts
SELECT u.email, sp.platform, sp.publishedAt, sp.content
FROM scheduled_posts sp
JOIN users u ON sp."userId" = u.id
WHERE sp.status = 'PUBLISHED'
ORDER BY sp.publishedAt DESC
LIMIT 10;

-- Posts pending publishing
SELECT u.email, sp.platform, sp.scheduledFor, sp.content
FROM scheduled_posts sp
JOIN users u ON sp."userId" = u.id
WHERE sp.status = 'SCHEDULED' AND sp.scheduledFor <= NOW()
ORDER BY sp.scheduledFor ASC;
```

---

## 🚀 Deployment Checklist

Before deploying to production:

- [ ] All migrations applied: `npx prisma migrate deploy`
- [ ] Prisma client generated: `npx prisma generate`
- [ ] Environment variables set in Vercel:
  - `DATABASE_URL` (production database)
  - `CRON_SECRET` (for authenticating cron jobs)
  - `ENCRYPTION_KEY` (for token encryption)
  - `GROQ_API_KEYS` (comma-separated for rate limiting)
- [ ] CRON jobs configured (use cron-job.org or Vercel Cron)
- [ ] At least one user has social accounts connected
- [ ] At least one user is subscribed to a topic

---

## 📈 Performance Metrics

**Expected Throughput:**
- RSS Processing: ~50 feeds in 2 minutes
- Post Generation: 1 feed per 15 seconds (with GROQ)
- Distribution: 10 users scheduled per second
- Publishing: 1 post per second (with rate limit safety)

**Vercel Limits:**
- Hobby: 10s timeout per function
- Pro: 60s timeout per function

**Best Practice:**
- Process ONE queue job per invocation
- Publish 10 posts per minute
- Run process-queue every 15 minutes
- Run publish-posts every 1 minute
