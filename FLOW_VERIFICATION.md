# Flow Verification - Complete Workflow

## ✅ CORRECTED FLOW

### Step 1: Fetch Feeds (Cron: Every hour)
**Endpoint:** `/api/cron/process-feeds`

```typescript
// src/lib/feed-processor.ts - addFeedItem()

// ✅ SKIP if no publishedAt
if (!item.publishedAt) {
  return 'skipped'
}

// ✅ SKIP if older than 24 hours
const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
if (new Date(item.publishedAt) < twentyFourHoursAgo) {
  return 'skipped'
}

// ✅ Check duplicate
if (existing) {
  return 'duplicate'
}

// ✅ Store as PENDING
await prisma.feed.create({
  status: "PENDING",
  publishedAt: item.publishedAt // Only recent items
})

return 'added'
```

**Result:**
- ✅ Only items from last 24 hours stored
- ✅ Items without publishedAt are skipped
- ✅ Old items never enter the database

---

### Step 2: Admin Reviews & Approves
**Endpoint:** `/admin/feeds` (UI) → `/api/admin/feeds/[id]` (API)

```typescript
// src/app/api/admin/feeds/[id]/route.ts

// ✅ Update status to APPROVED
await prisma.feed.update({
  where: { id },
  data: {
    status: "APPROVED",
    approvedAt: new Date(),
    approvedBy: session.user.id
  }
})

// ✅ Add to queue for processing
await enqueueApprovedFeed(feed.id, session.user.id)
```

**Result:**
- ✅ Feed status: PENDING → APPROVED
- ✅ Feed added to Redis queue
- ✅ Ready for auto-generation

---

### Step 3: Queue Processor (Cron: Every 10 min)
**Endpoint:** `/api/cron/process-queue`

```typescript
// 1. Dequeue next job
const job = await dequeueNextJob()

// 2. Generate Twitter post
const twitterContent = await generatePost({
  title: feed.title,
  summary: feed.summary,
  url: feed.url,
  platform: "twitter",
  waitForRateLimit: true // ✅ Waits up to 10 min
})

// 3. Generate LinkedIn post
const linkedinContent = await generatePost({
  title: feed.title,
  summary: feed.summary,
  url: feed.url,
  platform: "linkedin",
  waitForRateLimit: true // ✅ Waits up to 10 min
})

// 4. Store generated content
await prisma.generatedPost.update({
  where: { feedId },
  data: {
    twitterContent,
    linkedinContent,
    status: "COMPLETED"
  }
})
```

**Result:**
- ✅ Twitter post generated
- ✅ LinkedIn post generated
- ✅ Stored in GeneratedPost table
- ✅ Status: PENDING → GENERATING → COMPLETED

---

### Step 4: Auto-Distribution (Immediate after generation)
**Function:** `distributeToSubscribers(feedId)`

```typescript
// src/lib/auto-scheduler.ts

// 1. Get generated content
const generatedPost = await prisma.generatedPost.findUnique({
  where: { feedId }
})

// 2. Get all subscribers of this topic
const subscribers = await prisma.userTopic.findMany({
  where: { topicId: feed.topicId },
  include: {
    user: {
      include: { socialAccounts: true }
    }
  }
})

// 3. For each subscriber:
for (const subscription of subscribers) {
  const user = subscription.user

  // ✅ Schedule Twitter post (if user has Twitter connected)
  if (twitterAccount) {
    await prisma.scheduledPost.create({
      data: {
        userId: user.id,
        socialAccountId: twitterAccount.id,
        feedId: feed.id,
        platform: "TWITTER",
        content: generatedPost.twitterContent, // ✅ Uses generated content
        scheduledFor: nextOptimalTime,
        status: "SCHEDULED"
      }
    })
  }

  // ✅ Schedule LinkedIn post (if user has LinkedIn connected)
  if (linkedinAccount) {
    await prisma.scheduledPost.create({
      data: {
        userId: user.id,
        socialAccountId: linkedinAccount.id,
        feedId: feed.id,
        platform: "LINKEDIN",
        content: generatedPost.linkedinContent, // ✅ Uses generated content
        scheduledFor: nextOptimalTime,
        status: "SCHEDULED"
      }
    })
  }
}

// 4. Mark as distributed
await prisma.generatedPost.update({
  where: { id: generatedPost.id },
  data: { status: "DISTRIBUTED" }
})
```

**Result:**
- ✅ ALL subscribers get scheduled posts
- ✅ Uses the SAME generated content for all users
- ✅ Staggered scheduling times (natural distribution)
- ✅ Posts created in ScheduledPost table

---

### Step 5: Publish Posts (Cron: Every minute)
**Endpoint:** `/api/cron/publish-posts` (Already exists)

```typescript
// Find posts ready to publish
const postsToPublish = await prisma.scheduledPost.findMany({
  where: {
    scheduledFor: { lte: new Date() },
    status: "SCHEDULED"
  }
})

// Publish each post
for (const post of postsToPublish) {
  // Publish to Twitter/LinkedIn
  // Update status to PUBLISHED
}
```

**Result:**
- ✅ Posts published at scheduled time
- ✅ Status: SCHEDULED → PUBLISHING → PUBLISHED

---

## Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ STEP 1: FETCH FEEDS (Hourly Cron)                          │
│ /api/cron/process-feeds                                    │
├─────────────────────────────────────────────────────────────┤
│ • Only subscribed topics                                    │
│ • Parse RSS feeds                                           │
│ • ✅ SKIP if no publishedAt                                 │
│ • ✅ SKIP if older than 24 hours                            │
│ • ✅ Check duplicates                                       │
│ • Store as PENDING (only recent items)                     │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 2: ADMIN APPROVAL (Manual)                            │
│ /admin/feeds → /api/admin/feeds/[id]                       │
├─────────────────────────────────────────────────────────────┤
│ • Admin sees PENDING feeds (only last 24h)                 │
│ • Clicks "Approve"                                         │
│ • ✅ Status: PENDING → APPROVED                            │
│ • ✅ Enqueue for processing (Redis)                        │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 3: GENERATE POSTS (Every 10 min Cron)                │
│ /api/cron/process-queue                                    │
├─────────────────────────────────────────────────────────────┤
│ • Dequeue next approved feed                               │
│ • ✅ Generate Twitter post (GROQ + wait for rate limits)   │
│ • ✅ Generate LinkedIn post (GROQ + wait for rate limits)  │
│ • ✅ Store in GeneratedPost table                          │
│ • Status: PENDING → GENERATING → COMPLETED                 │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 4: DISTRIBUTE TO SUBSCRIBERS (Immediate)              │
│ distributeToSubscribers()                                   │
├─────────────────────────────────────────────────────────────┤
│ • Get ALL users subscribed to topic                        │
│ • For each user:                                           │
│   - Check social accounts (Twitter/LinkedIn)               │
│   - ✅ Create ScheduledPost with generated content         │
│   - Use staggered times (cycles through optimal hours)     │
│ • Status: DISTRIBUTING → DISTRIBUTED                       │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ STEP 5: PUBLISH POSTS (Every minute Cron)                 │
│ /api/cron/publish-posts                                    │
├─────────────────────────────────────────────────────────────┤
│ • Find posts where scheduledFor <= NOW()                   │
│ • Publish to Twitter/LinkedIn API                          │
│ • Status: SCHEDULED → PUBLISHING → PUBLISHED               │
└─────────────────────────────────────────────────────────────┘
```

---

## Key Points

### ✅ 24-Hour Filter (DURING FETCH)
- Items without `publishedAt` → **SKIPPED**
- Items older than 24h → **SKIPPED**
- Only recent items → **STORED AS PENDING**

### ✅ Admin Approval
- Reviews only feeds from last 24h
- Approves → Automatically queued

### ✅ Queue Processing
- Generates posts using GROQ
- Waits for rate limits (no failures)
- Stores generated content

### ✅ Auto-Distribution
- ALL topic subscribers get posts
- Uses SAME generated content (1 GROQ call per platform, not per user!)
- Staggered times for natural posting

### ✅ Publishing
- Automated at scheduled times
- Already implemented

---

## Testing

```bash
# 1. Fetch feeds (with 24h filter)
curl -H "Authorization: Bearer dev-cron-secret" \
  http://localhost:3000/api/cron/process-feeds

# Response will show:
# - newItems: X (items from last 24h)
# - duplicates: Y
# - skipped: Z (old items or items without date)

# 2. Approve via UI
# Go to: http://localhost:3000/admin/feeds

# 3. Process queue
curl -H "Authorization: Bearer dev-cron-secret" \
  http://localhost:3000/api/cron/process-queue

# 4. Check scheduled posts
# Go to: http://localhost:3000/posts
```

Or run the automated test:
```bash
npm test
```

---

## Summary

✅ **Step 1:** Fetch feeds → SKIP old items (24h filter)
✅ **Step 2:** Admin approves → Queue
✅ **Step 3:** Generate posts (GROQ)
✅ **Step 4:** Distribute to ALL subscribers with generated content
✅ **Step 5:** Publish at scheduled times

**The flow is now exactly as you described!** 🎯
