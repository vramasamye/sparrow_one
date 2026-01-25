# Quick Start: Automated Workflow

## ✅ Implementation Complete!

Your fully automated content workflow is ready:

**Admin approves** → **Queue** → **Generate (GROQ)** → **Distribute to all subscribers** → **Publish**

---

## 🚀 Test It Now

```bash
npm run test:auto-flow
```

This will:
1. ✅ Create/find a pending feed
2. ✅ Simulate admin approval
3. ✅ Queue the feed
4. ✅ Generate Twitter + LinkedIn posts using GROQ
5. ✅ Distribute to ALL subscribers automatically
6. ✅ Show scheduled posts

---

## 📋 What Was Implemented

### 1. **Redis-Based Queue** ✅
- No BullMQ needed
- Works on Vercel
- Simple and efficient
- Crash recovery built-in

### 2. **Auto-Generation** ✅
- Uses GROQ with rate limit retry
- Waits up to 10 minutes if rate limited
- Generates Twitter + LinkedIn posts
- Stores in `GeneratedPost` table

### 3. **Auto-Distribution** ✅
- Finds ALL subscribers of the topic
- Schedules posts for each user
- Uses staggered times (natural distribution)
- Checks social account connections

### 4. **24-Hour Filter** ✅
- Only processes feeds from last 24h
- Cleans up old pending feeds
- Keeps database lean

### 5. **New Database Model** ✅
- `GeneratedPost` table
- Tracks generation status
- Stores Twitter & LinkedIn content
- Links to feed

---

## 🔧 Setup Cron Jobs

### Option A: Vercel Cron (Recommended)

Create `vercel.json` in project root:

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

Deploy to Vercel and crons will run automatically!

### Option B: External Cron Service

Use **cron-job.org** or **EasyCron**:

**Job 1: Feed Fetching (Every hour)**
```
URL: https://yourdomain.com/api/cron/process-feeds
Method: GET
Headers: Authorization: Bearer YOUR_CRON_SECRET
Schedule: 0 * * * *
```

**Job 2: Queue Processing (Every 10 minutes)**
```
URL: https://yourdomain.com/api/cron/process-queue
Method: GET
Headers: Authorization: Bearer YOUR_CRON_SECRET
Schedule: */10 * * * *
```

**Job 3: Post Publishing (Every minute)**
```
URL: https://yourdomain.com/api/cron/publish-posts
Method: GET
Headers: Authorization: Bearer YOUR_CRON_SECRET
Schedule: * * * * *
```

---

## 📊 Monitor The System

### Check Queue Status

```bash
# Via test script
npm run test:background

# Via API
curl -H "Authorization: Bearer dev-cron-secret" \
  http://localhost:3000/api/cron/process-queue
```

### Check Database

```sql
-- Generated posts
SELECT * FROM generated_posts ORDER BY createdAt DESC LIMIT 10;

-- Scheduled posts by feed
SELECT sp.*, u.email, f.title
FROM scheduled_posts sp
JOIN users u ON sp.userId = u.id
JOIN feeds f ON sp.feedId = f.id
WHERE sp.feedId = 'your-feed-id'
ORDER BY sp.scheduledFor;

-- Queue processing stats
SELECT COUNT(*) as total, status FROM generated_posts GROUP BY status;
```

### Check Redis Queue

```bash
redis-cli -h localhost -p 6380

# View queue
ZRANGE queue:approved-feeds 0 -1 WITHSCORES

# Get size
ZCARD queue:approved-feeds
```

---

## 🎯 How It Works

### Current Flow

```
1. Cron fetches RSS feeds (hourly)
   ↓ Only subscribed topics
   ↓ Only last 24 hours
   ↓ Stores as PENDING

2. Admin approves feed
   ↓ Status: APPROVED
   ↓ Added to Redis queue

3. Queue processor runs (every 10 min)
   ↓ Generates Twitter post (GROQ)
   ↓ Generates LinkedIn post (GROQ)
   ↓ Waits if rate limited
   ↓ Stores in GeneratedPost

4. Auto-distribution (immediate)
   ↓ Gets all topic subscribers
   ↓ For each user:
   ↓   - Check social accounts
   ↓   - Schedule Twitter (if connected)
   ↓   - Schedule LinkedIn (if connected)
   ↓   - Use staggered times

5. Publish cron runs (every minute)
   ↓ Publishes scheduled posts
   ↓ Updates status to PUBLISHED
```

### Key Features

✅ **No manual scheduling** - Fully automatic
✅ **One GROQ call per post** - Not per user
✅ **Respects rate limits** - Waits and retries
✅ **Staggered distribution** - Natural posting times
✅ **24h content only** - Fresh and relevant
✅ **Subscriber-based** - Only fetches what's needed

---

## 🧪 Testing Scenarios

### Test 1: Single Feed Approval
```bash
npm run test:auto-flow
```

### Test 2: Multiple Approvals
1. Approve 5-10 feeds in admin panel
2. Check queue: `npm run test:background`
3. Manually trigger processor:
   ```bash
   curl -H "Authorization: Bearer dev-cron-secret" \
     http://localhost:3000/api/cron/process-queue
   ```
4. Repeat until queue is empty

### Test 3: Rate Limit Handling
1. Approve many feeds quickly
2. Watch queue processor wait for rate limits
3. Verify all eventually process

---

## 📈 Capacity Planning

### With 3 GROQ Keys:
- 120 requests/min
- 3,000 requests/day

### Queue Processor (Every 10 min):
- 1 feed per run
- 2 GROQ calls per feed (Twitter + LinkedIn)
- 6 feeds/hour
- 144 feeds/day
- 288 GROQ calls/day ✅ (well under limit)

### To Increase Capacity:
- Run queue processor every 5 min → 288 feeds/day
- Add more GROQ keys → multiply capacity
- Process multiple jobs per run (Pro plan)

---

## 🐛 Troubleshooting

### Queue not processing
```bash
# Check queue status
npm run test:background

# Check Redis
redis-cli -h localhost -p 6380
ZRANGE queue:approved-feeds 0 -1

# Manually trigger
curl -H "Authorization: Bearer dev-cron-secret" \
  http://localhost:3000/api/cron/process-queue
```

### No subscribers getting posts
```sql
-- Check subscriptions
SELECT u.email, t.name, COUNT(sa.id) as social_accounts
FROM user_topics ut
JOIN users u ON ut.userId = u.id
JOIN topics t ON ut.topicId = t.id
LEFT JOIN social_accounts sa ON u.id = sa.userId AND sa.isActive = true
GROUP BY u.email, t.name;
```

### GROQ rate limited
- System will wait automatically (up to 10 minutes)
- Check: `npm run test:background` for rate limit status
- Add more GROQ keys if needed

---

## 📚 Documentation

- **AUTOMATED_WORKFLOW.md** - Complete technical docs
- **RATE_LIMITING.md** - GROQ rate limit details
- **BACKGROUND_PROCESSING.md** - Cron job guide
- **OPTIMIZATION_SUMMARY.md** - Performance optimizations

---

## ✅ Checklist

Before deploying to production:

- [ ] All 3 GROQ keys configured
- [ ] Redis accessible
- [ ] CRON_SECRET set
- [ ] Database migrated (`npx prisma db push`)
- [ ] Test script passes (`npm run test:auto-flow`)
- [ ] Cron jobs configured
- [ ] Users have connected social accounts
- [ ] Topics have subscribers
- [ ] Monitoring setup

---

## 🎉 You're Ready!

The system is now **fully automated**:

1. ✅ Fetches feeds (subscribed topics only, last 24h)
2. ✅ Admin approves
3. ✅ Auto-generates posts (GROQ with rate limiting)
4. ✅ Auto-distributes to ALL subscribers
5. ✅ Auto-publishes at scheduled times

**No manual intervention needed!**

Run `npm run test:auto-flow` to see it in action! 🚀
