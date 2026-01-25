# Automated Content Workflow Implementation

## Overview

**Fully automated content workflow from RSS feed → Admin approval → AI generation → User scheduling**

This implementation provides:
- ✅ **Redis-based queue** (no BullMQ, works on Vercel)
- ✅ **24-hour feed filter** (only recent content)
- ✅ **Staggered distribution** (natural posting times)
- ✅ **Rate limit retry** (waits up to 10 minutes for GROQ)
- ✅ **Clean data model** (separate GeneratedPost table)
- ✅ **Serverless-friendly** (works on Vercel limits)

---

## Complete Workflow

```
┌──────────────────────────────────────────────────────────────┐
│ STEP 1: FETCH FEEDS (Cron: Every hour)                      │
│ /api/cron/process-feeds                                     │
├──────────────────────────────────────────────────────────────┤
│ • Get topics with subscribers ONLY                           │
│ • Fetch RSS feeds for those topics                          │
│ • Store as PENDING (last 24h only)                          │
│ • Cleanup feeds older than 24h                              │
└──────────────┬───────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────┐
│ STEP 2: ADMIN APPROVAL (Manual)                             │
│ /admin/feeds                                                 │
├──────────────────────────────────────────────────────────────┤
│ • Admin views PENDING feeds (last 24h only)                 │
│ • Clicks "Approve"                                          │
│ • Status → APPROVED                                         │
│ • Feed added to Redis queue                                 │
└──────────────┬───────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────┐
│ STEP 3: PROCESS QUEUE (Cron: Every 5-15 min)               │
│ /api/cron/process-queue                                     │
├──────────────────────────────────────────────────────────────┤
│ • Dequeue next approved feed                                │
│ • Generate Twitter post (GROQ, waitForRateLimit: true)     │
│ • Generate LinkedIn post (GROQ, waitForRateLimit: true)    │
│ • Store in GeneratedPost table                              │
│ • Status: PENDING → GENERATING → COMPLETED                  │
└──────────────┬───────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────┐
│ STEP 4: DISTRIBUTE TO SUBSCRIBERS (Automatic)               │
│ (Part of process-queue)                                     │
├──────────────────────────────────────────────────────────────┤
│ • Get all users subscribed to topic                         │
│ • For each user:                                            │
│   - Check connected social accounts                         │
│   - Schedule Twitter post (if connected)                    │
│   - Schedule LinkedIn post (if connected)                   │
│   - Use staggered times (cycle through optimal slots)      │
│ • Status: DISTRIBUTING → DISTRIBUTED                        │
└──────────────┬───────────────────────────────────────────────┘
               │
               ▼
┌──────────────────────────────────────────────────────────────┐
│ STEP 5: PUBLISH POSTS (Cron: Every minute)                 │
│ /api/cron/publish-posts                                     │
├──────────────────────────────────────────────────────────────┤
│ • Find posts where scheduledFor <= NOW()                    │
│ • Publish to Twitter/LinkedIn                               │
│ • Status: SCHEDULED → PUBLISHING → PUBLISHED                │
└──────────────────────────────────────────────────────────────┘
```

---

## Database Schema Changes

### New Model: GeneratedPost

```prisma
model GeneratedPost {
  id              String              @id @default(cuid())
  feedId          String              @unique
  twitterContent  String              @db.Text
  linkedinContent String              @db.Text
  status          GeneratedPostStatus @default(PENDING)
  generatedAt     DateTime            @default(now())
  distributedAt   DateTime?
  errorMessage    String?
  retryCount      Int                 @default(0)
  createdAt       DateTime            @default(now())
  updatedAt       DateTime            @updatedAt

  feed Feed @relation(...)
}

enum GeneratedPostStatus {
  PENDING      // Queued for generation
  GENERATING   // Currently generating with GROQ
  COMPLETED    // Generated successfully
  DISTRIBUTING // Distributing to subscribers
  DISTRIBUTED  // Distributed to all subscribers
  FAILED       // Generation failed
}
```

### Updated Model: Feed

```prisma
model Feed {
  // ... existing fields
  generatedPosts GeneratedPost[]  // NEW relation
}
```

---

## New Files Created

### 1. Queue System (`src/lib/queue.ts`)

Simple Redis-based queue:
- `enqueueApprovedFeed()` - Add feed to queue
- `dequeueNextJob()` - Get next job
- `markJobCompleted()` - Mark as done
- `markJobFailed()` - Handle failures
- `getQueueStats()` - Monitor queue
- `recoverStuckJobs()` - Crash recovery

### 2. Auto-Generator (`src/lib/auto-generator.ts`)

GROQ-powered post generation:
- `generatePostsForFeed()` - Generate Twitter + LinkedIn
- `waitForRateLimit: true` - Waits up to 10 minutes
- Stores in GeneratedPost table
- Error handling and retry logic

### 3. Auto-Scheduler (`src/lib/auto-scheduler.ts`)

Subscriber distribution:
- `distributeToSubscribers()` - Schedule for all users
- Staggered timing (cycles through optimal hours)
- Checks social account connections
- Handles edge cases (no connections, etc.)

### 4. Queue Processor Cron (`src/app/api/cron/process-queue/route.ts`)

Cron endpoint:
- Processes ONE job per invocation (Vercel limits)
- Generates posts
- Distributes to subscribers
- Returns detailed stats

### 5. Test Script (`scripts/test-auto-flow.ts`)

End-to-end test:
- Simulates admin approval
- Enqueues feed
- Generates posts
- Distributes to subscribers
- Verifies scheduled posts

---

## Updated Files

### 1. Feed Processor (`src/lib/feed-processor.ts`)

**Changes:**
- Only processes subscribed topics ✅
- Added `cleanupOldFeeds()` function
- Removes PENDING feeds older than 24h

### 2. Admin Feeds API (`src/app/api/admin/feeds/route.ts`)

**Changes:**
- Filters PENDING feeds to last 24h only
- Other statuses show all time

### 3. Admin Feed Approval (`src/app/api/admin/feeds/[id]/route.ts`)

**Changes:**
- On approval → Enqueues feed
- Triggers automated workflow

### 4. Feed Processing Cron (`src/app/api/cron/process-feeds/route.ts`)

**Changes:**
- Calls `cleanupOldFeeds()` before processing
- Reports cleanup stats

### 5. Rate Limiter (`src/lib/rate-limiter.ts`)

**New Functions:**
- `waitForAvailableKey()` - Retry logic with delays
- `getDetailedRateLimitStatus()` - Per-key stats

### 6. AI Generator (`src/lib/ai.ts`)

**New Parameter:**
- `waitForRateLimit?: boolean` - Enable retry logic
- Used by auto-generator (true)
- Used by manual requests (false)

---

## Cron Job Setup

### Required Cron Jobs

#### 1. Feed Fetching (Every hour)
```
GET https://yourdomain.com/api/cron/process-feeds
Authorization: Bearer {CRON_SECRET}
Schedule: 0 * * * * (every hour at minute 0)
```

**What it does:**
- Fetches RSS feeds (subscribed topics only)
- Stores as PENDING
- Cleans up old feeds (>24h)

#### 2. Queue Processing (Every 5-15 minutes)
```
GET https://yourdomain.com/api/cron/process-queue
Authorization: Bearer {CRON_SECRET}
Schedule: */10 * * * * (every 10 minutes)
```

**What it does:**
- Processes ONE approved feed
- Generates Twitter + LinkedIn posts
- Distributes to all subscribers
- Respects GROQ rate limits (waits if needed)

#### 3. Post Publishing (Every minute)
```
GET https://yourdomain.com/api/cron/publish-posts
Authorization: Bearer {CRON_SECRET}
Schedule: * * * * * (every minute)
```

**What it does:**
- Publishes scheduled posts
- Updates status to PUBLISHED
- Records in history

---

## Vercel Deployment

### vercel.json Configuration

```json
{
  "crons": [
    {
      "path": "/api/cron/process-feeds",
      "schedule": "0 * * * *"
    },
    {
      "path": "/api/cron/process-queue",
      "schedule": "*/10 * * * *"
    },
    {
      "path": "/api/cron/publish-posts",
      "schedule": "* * * * *"
    }
  ]
}
```

### Environment Variables

```bash
# Required
DATABASE_URL="postgresql://..."
REDIS_URL="redis://..."
GROQ_API_KEYS="key1,key2,key3"
NEXTAUTH_SECRET="..."
CRON_SECRET="..."
ENCRYPTION_KEY="..."

# OAuth
GOOGLE_CLIENT_ID="..."
GOOGLE_CLIENT_SECRET="..."
TWITTER_CLIENT_ID="..."
TWITTER_CLIENT_SECRET="..."

# Optional fallback
OPENROUTER_API_KEY="..."
```

---

## Testing

### Run Database Migration

```bash
# Generate Prisma client with new schema
npx prisma generate

# Push schema changes to database
npx prisma db push
```

### Run End-to-End Test

```bash
npm run test:auto-flow
```

**This test will:**
1. ✅ Check environment variables
2. ✅ Find/create a pending feed
3. ✅ Simulate admin approval
4. ✅ Enqueue for processing
5. ✅ Generate posts with GROQ
6. ✅ Distribute to subscribers
7. ✅ Verify scheduled posts
8. ✅ Show complete statistics

### Manual Testing

#### 1. Test Feed Fetch
```bash
curl -H "Authorization: Bearer dev-cron-secret" \
  http://localhost:3000/api/cron/process-feeds
```

#### 2. Test Queue Processing
```bash
curl -H "Authorization: Bearer dev-cron-secret" \
  http://localhost:3000/api/cron/process-queue
```

#### 3. Check Queue Status
```typescript
import { getQueueStats, peekQueue } from "@/lib/queue"

const stats = await getQueueStats()
const jobs = await peekQueue(10)
```

---

## Monitoring

### Queue Statistics

```bash
# In Redis CLI
redis-cli -h localhost -p 6380

# View queue
ZRANGE queue:approved-feeds 0 -1

# Get queue size
ZCARD queue:approved-feeds
```

### Database Queries

```sql
-- Check generated posts
SELECT fp.feedId, fp.status, fp.generatedAt, f.title
FROM generated_posts fp
JOIN feeds f ON fp.feedId = f.id
ORDER BY fp.createdAt DESC
LIMIT 10;

-- Check scheduled posts
SELECT sp.scheduledFor, sp.platform, sp.status, u.email, f.title
FROM scheduled_posts sp
JOIN users u ON sp.userId = u.id
JOIN feeds f ON sp.feedId = f.id
WHERE sp.feedId = 'some-feed-id'
ORDER BY sp.scheduledFor;

-- Check distribution stats
SELECT COUNT(*) as total, platform, status
FROM scheduled_posts
WHERE feedId = 'some-feed-id'
GROUP BY platform, status;
```

---

## Performance & Limits

### GROQ Rate Limits (3 keys)

- **120 requests/min** (40 × 3)
- **3,000 requests/day** (1,000 × 3)
- **27,000 tokens/min** (9,000 × 3)
- **750,000 tokens/day** (250,000 × 3)

### Processing Capacity

**With queue processor running every 10 minutes:**
- 6 feeds/hour
- 144 feeds/day
- Each feed = 2 GROQ calls (Twitter + LinkedIn)
- 288 GROQ calls/day (well under 3,000 limit)

**To increase capacity:**
- Run queue processor more frequently (every 5 min = 288 feeds/day)
- Add more GROQ keys
- Adjust cron schedule

### Vercel Limits

**Hobby Plan:**
- 10s function timeout
- Process 1 job per invocation ✅

**Pro Plan:**
- 60s function timeout
- Can process 2-3 jobs per invocation

---

## Troubleshooting

### Issue: Queue not processing

**Check:**
1. Queue processor cron is running
2. GROQ keys are valid
3. Redis is accessible
4. Check logs for errors

**Solution:**
```bash
# Check queue
npm run test:auto-flow

# Manually trigger
curl -H "Authorization: Bearer dev-cron-secret" \
  http://localhost:3000/api/cron/process-queue
```

### Issue: No posts generated

**Check:**
1. Feed is APPROVED (not PENDING)
2. Feed is in queue
3. GROQ rate limits not exhausted
4. Check GeneratedPost table

**Solution:**
```typescript
// Check if feed has generated content
const gen = await prisma.generatedPost.findUnique({
  where: { feedId: 'feed-id' }
})
console.log(gen?.status, gen?.errorMessage)
```

### Issue: No posts scheduled for users

**Check:**
1. Users are subscribed to the topic
2. Users have connected social accounts
3. Social accounts are active

**Solution:**
```sql
-- Check subscribers
SELECT u.email, COUNT(sa.id) as accounts
FROM user_topics ut
JOIN users u ON ut.userId = u.id
LEFT JOIN social_accounts sa ON u.id = sa.userId
WHERE ut.topicId = 'topic-id'
GROUP BY u.email;
```

### Issue: All feeds showing as duplicates

**This is normal!** RSS feeds don't change every hour. New items appear gradually.

---

## Summary of Changes

### ✅ What's New

1. **Redis Queue** - Simple, serverless-friendly
2. **Auto-Generation** - GROQ with rate limit retry
3. **Auto-Distribution** - Staggered scheduling for all subscribers
4. **24h Filter** - Only recent feeds (created in last 24h)
5. **GeneratedPost Model** - Clean data separation
6. **Queue Processor Cron** - Automated workflow
7. **Cleanup Job** - Removes old pending feeds

### ✅ What Was Updated

1. **Feed Processor** - Subscriber-based + cleanup
2. **Admin API** - 24h filter + enqueue on approval
3. **Rate Limiter** - Wait/retry logic
4. **AI Generator** - Optional wait parameter

### ✅ Testing

1. **test-auto-flow.ts** - Complete end-to-end test
2. All existing tests still work

---

## Next Steps

1. **Run Migration:**
   ```bash
   npx prisma db push
   ```

2. **Test Locally:**
   ```bash
   npm run test:auto-flow
   ```

3. **Deploy to Vercel:**
   - Push code
   - Add environment variables
   - Verify cron jobs are running

4. **Monitor:**
   - Check queue size
   - Monitor GROQ usage
   - Review scheduled posts

---

**The system is now fully automated!** 🎉

Admin approves → Queue → Generate → Distribute → Schedule → Publish

All happening automatically, respecting rate limits, and optimized for efficiency.
