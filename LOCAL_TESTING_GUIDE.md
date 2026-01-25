# Local Testing Guide - Complete Automated Flow

## Prerequisites

Make sure these are running:

```bash
# 1. PostgreSQL (Docker or local)
docker-compose up -d postgres
# or your local PostgreSQL

# 2. Redis (Docker or local)
docker-compose up -d redis
# or your local Redis

# 3. Check they're running
docker ps
```

---

## Quick Test (Automated Script)

```bash
npm test
```

This runs the automated test that:
- ✅ Simulates admin approval
- ✅ Generates posts with GROQ
- ✅ Distributes to subscribers
- ✅ Shows scheduled posts

**That's it!** This tests the entire flow end-to-end.

---

## Full Manual Test (With UI)

### Step 1: Start Dev Server

```bash
npm run dev
```

### Step 2: Login & Setup

1. Go to http://localhost:3000
2. Login with Google (or your configured OAuth)
3. Make sure you have:
   - At least one topic subscription
   - At least one social account connected (Twitter or LinkedIn)

### Step 3: Seed Data (If Needed)

```bash
npm run db:seed
```

This creates:
- Topics (AI, Web Development, etc.)
- RSS feeds for each topic
- Admin user (if needed)

### Step 4: Subscribe to a Topic

1. Go to http://localhost:3000/feed
2. Click on a topic
3. Make sure you're subscribed

### Step 5: Fetch RSS Feeds

**Option A: Run cron manually**
```bash
curl -H "Authorization: Bearer dev-cron-secret" \
  http://localhost:3000/api/cron/process-feeds
```

**Option B: Use the test script**
```bash
npm test
# This also fetches feeds automatically
```

You should see output like:
```json
{
  "success": true,
  "summary": {
    "feedsProcessed": 3,
    "newItems": 5,
    "duplicates": 12
  }
}
```

### Step 6: Approve Feeds (Admin)

**Option A: Via UI**
1. Go to http://localhost:3000/admin/feeds
2. You'll see pending feeds (last 24h only)
3. Click "Approve" on one or more feeds
4. ✅ Feeds are automatically queued!

**Option B: Via test script**
```bash
npm test
# This auto-approves a feed for testing
```

### Step 7: Process Queue (Generate & Distribute)

**Option A: Run cron manually**
```bash
curl -H "Authorization: Bearer dev-cron-secret" \
  http://localhost:3000/api/cron/process-queue
```

**Option B: Already done by test script**
```bash
npm test
# This processes the entire queue
```

You should see:
```json
{
  "success": true,
  "feedId": "...",
  "generation": { "success": true },
  "distribution": {
    "usersScheduled": 1,
    "twitterScheduled": 1,
    "linkedinScheduled": 1
  }
}
```

### Step 8: Check Scheduled Posts

**Via UI:**
1. Go to http://localhost:3000/posts
2. You'll see your scheduled posts

**Via Database:**
```bash
npm run db:studio
# Opens Prisma Studio
# Navigate to: scheduled_posts table
```

**Via API:**
```bash
curl http://localhost:3000/api/posts
```

### Step 9: Test Publishing (Optional)

To test actual publishing:

```bash
curl -H "Authorization: Bearer dev-cron-secret" \
  http://localhost:3000/api/cron/publish-posts
```

This publishes posts where `scheduledFor <= NOW()`.

---

## Testing Scenarios

### Scenario 1: Single Feed Approval

```bash
# 1. Start clean
npm run dev

# 2. Run test (does everything)
npm test

# Expected: Feed approved → Generated → Distributed → Scheduled
```

### Scenario 2: Multiple Feeds with Rate Limiting

```bash
# 1. Approve 10 feeds via UI
# Go to /admin/feeds
# Click approve on 10 different feeds

# 2. Watch queue process them
curl -H "Authorization: Bearer dev-cron-secret" \
  http://localhost:3000/api/cron/process-queue

# Run this multiple times (once per feed)
# You'll see GROQ generation with rate limit handling
```

### Scenario 3: Multiple Users, One Feed

```bash
# 1. Create 3 users (or login as 3 different users)
# 2. All subscribe to same topic
# 3. Admin approves one feed
# 4. Run queue processor

# Expected: All 3 users get scheduled posts (staggered times)
```

---

## Check Queue Status

```bash
# Via test script (shows everything)
npm test

# Via Redis CLI
redis-cli -h localhost -p 6380
ZRANGE queue:approved-feeds 0 -1 WITHSCORES
ZCARD queue:approved-feeds

# Via API endpoint
curl -H "Authorization: Bearer dev-cron-secret" \
  http://localhost:3000/api/cron/process-queue
```

---

## Database Inspection

```bash
# Open Prisma Studio
npm run db:studio

# Tables to check:
# - feeds (status: PENDING → APPROVED)
# - generated_posts (status: PENDING → GENERATING → COMPLETED → DISTRIBUTED)
# - scheduled_posts (your scheduled posts)
# - user_topics (subscriptions)
# - social_accounts (connected accounts)
```

---

## Common Issues & Solutions

### Issue 1: "No GROQ API keys"

**Solution:**
```bash
# Check .env.local
cat .env.local | grep GROQ

# Should see:
GROQ_API_KEYS="key1,key2,key3"
```

### Issue 2: "No pending feeds"

**Solution:**
```bash
# Fetch feeds first
curl -H "Authorization: Bearer dev-cron-secret" \
  http://localhost:3000/api/cron/process-feeds

# Check they exist
npm run db:studio
# Look at feeds table
```

### Issue 3: "Queue is empty"

**Solution:**
```bash
# Approve a feed first (via UI or test script)
# Then run queue processor
```

### Issue 4: "No users scheduled"

**Possible causes:**
1. User not subscribed to topic
2. User has no social accounts connected
3. Social accounts are inactive

**Check:**
```sql
-- In Prisma Studio or psql
SELECT
  u.email,
  t.name as topic,
  COUNT(sa.id) as social_accounts,
  COUNT(ut.id) as subscriptions
FROM users u
LEFT JOIN user_topics ut ON u.id = ut.userId
LEFT JOIN topics t ON ut.topicId = t.id
LEFT JOIN social_accounts sa ON u.id = sa.userId AND sa.isActive = true
GROUP BY u.email, t.name;
```

---

## Complete Local Test Flow

```bash
# 1. Prerequisites
docker-compose up -d postgres redis

# 2. Install & Setup
npm install
npx prisma generate
npx prisma db push

# 3. Seed data (optional)
npm run db:seed

# 4. Start dev server (in one terminal)
npm run dev

# 5. Run automated test (in another terminal)
npm test

# Expected output:
# ✅ Feed approved
# ✅ Enqueued
# ✅ Posts generated (Twitter + LinkedIn)
# ✅ Distributed to 1 user
# ✅ 2 posts scheduled
```

---

## Manual Cron Testing

If you want to test cron endpoints manually:

```bash
# Terminal 1: Dev server
npm run dev

# Terminal 2: Trigger crons
# Fetch feeds (every hour in production)
curl -H "Authorization: Bearer dev-cron-secret" \
  http://localhost:3000/api/cron/process-feeds

# Process queue (every 10 min in production)
curl -H "Authorization: Bearer dev-cron-secret" \
  http://localhost:3000/api/cron/process-queue

# Publish posts (every minute in production)
curl -H "Authorization: Bearer dev-cron-secret" \
  http://localhost:3000/api/cron/publish-posts
```

---

## Verify Everything Works

```bash
# 1. Check queue stats
redis-cli -h localhost -p 6380
ZCARD queue:approved-feeds

# 2. Check generated posts
npm run db:studio
# Table: generated_posts
# Should show: status = DISTRIBUTED

# 3. Check scheduled posts
npm run db:studio
# Table: scheduled_posts
# Should show posts for each user

# 4. Check feed status
npm run db:studio
# Table: feeds
# Should show: status = APPROVED
```

---

## Quick Checklist

Before testing, make sure:

- [ ] PostgreSQL running
- [ ] Redis running
- [ ] `.env.local` has GROQ keys
- [ ] At least 1 user exists
- [ ] User has subscribed to a topic
- [ ] User has connected social account(s)
- [ ] Database is migrated (`npx prisma db push`)

Then just run:
```bash
npm test
```

---

## What `npm test` Does

The automated test script:

1. ✅ Checks environment (DB, Redis, GROQ)
2. ✅ Shows system stats (users, topics, feeds)
3. ✅ Finds/creates a pending feed
4. ✅ Simulates admin approval
5. ✅ Enqueues the feed
6. ✅ Generates Twitter post (GROQ)
7. ✅ Generates LinkedIn post (GROQ)
8. ✅ Gets all subscribers of the topic
9. ✅ Schedules posts for each subscriber
10. ✅ Shows scheduled posts with times
11. ✅ Displays complete statistics

**All in one command!**

---

## Expected Output

```
╔═══════════════════════════════════════════════════════════════════════╗
║           AUTOMATED WORKFLOW TEST - FULL END-TO-END                   ║
║  Admin Approve → Queue → Generate (GROQ) → Distribute → Schedule     ║
╚═══════════════════════════════════════════════════════════════════════╝

============================================================
STEP 1: ENVIRONMENT CHECK
============================================================

✅  Database: Connected
✅  Redis: Connected
✅  GROQ Keys: Configured

============================================================
STEP 2: SYSTEM STATISTICS
============================================================

👥  Users: 1
📚  Topics: 5
📥  Pending Feeds: 3
🔗  Subscriptions: 1

... (more steps)

============================================================
STEP 6: AUTO-GENERATION WITH GROQ
============================================================

🤖  Starting post generation...
💡  This will wait for GROQ rate limits if needed
✅  Posts generated successfully!

--- TWITTER POST ---
🚀 Exciting AI breakthrough in 2026! This groundbreaking discovery...
https://example.com/article
---

--- LINKEDIN POST ---
A major advancement in artificial intelligence has been announced...
🔗 Read more: https://example.com/article
---

... (more steps)

╔═══════════════════════════════════════════════════════════════════════╗
║                  ✅ AUTOMATED WORKFLOW TEST PASSED                     ║
╚═══════════════════════════════════════════════════════════════════════╝
```

---

## You're Ready!

Just run:
```bash
npm test
```

That's all you need to test the complete automated workflow locally! 🚀
