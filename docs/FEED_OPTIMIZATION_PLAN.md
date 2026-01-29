# Feed Selection & Publishing Optimization Plan

## 🔴 Current Problems Identified

### 1. **No Quality Filtering**
- All RSS feeds are saved as "PENDING" regardless of quality
- Admin must manually review 100% of feeds
- No differentiation between high-quality and low-quality content

### 2. **Limited Capacity**
- Only **6 posts per user per day** (3 Twitter + 3 LinkedIn)
- With multiple topics and RSS feeds, you might fetch 50+ articles/day
- But can only use 6 → 88% waste!

### 3. **Poor Scheduling**
- All posts scheduled at fixed optimal times (9am, 12pm, 3pm, etc.)
- Multiple posts can cluster at same time
- No consideration for:
  - Topic diversity
  - User timezone
  - Content freshness
  - Engagement patterns

### 4. **Admin Burden**
- Manually approve every single feed
- No auto-approval for high-quality sources
- No trending indicators
- No relevance scoring

---

## ✅ Proposed Solution: AI-Powered Feed Ranking System

### **Phase 1: Auto-Scoring System** (Immediate Impact)

Add a **quality score** (0-100) to each feed based on:

#### **Scoring Factors:**

| Factor | Weight | How It Works |
|--------|--------|--------------|
| **Source Authority** | 30% | TechCrunch, Vercel = 100<br>Unknown blog = 50<br>Maintain whitelist |
| **Recency** | 25% | Published in last 2 hours = 100<br>Published 24h ago = 50<br>Older = lower |
| **Content Quality** | 20% | Title length, summary quality<br>Has image, author, metadata |
| **Engagement Potential** | 15% | Trending keywords (AI, ChatGPT, etc.)<br>Question titles ("How to...")<br>Numbers in title |
| **Topic Relevance** | 10% | How well it matches topic keywords |

**Auto-Approval Rules:**
- Score ≥ 80 → **Auto-approve** (high confidence)
- Score 60-79 → **Pending** (needs review)
- Score < 60 → **Auto-reject** (low quality)

**Result:**
- Admin only reviews 20-30% of feeds (score 60-79)
- 70% handled automatically
- Only see quality content

---

### **Phase 2: Smart Selection Algorithm** (Maximize Value)

Instead of "first come, first served", use **intelligent selection**:

#### **Daily Selection Process:**

```
For each user:
  1. Fetch all APPROVED feeds from subscribed topics
  2. Rank by quality score (highest first)
  3. Apply diversity rules:
     - Max 2 posts per topic per day
     - Max 1 post per RSS source per day
     - Spread across different optimal times
  4. Select top 6 (3 Twitter + 3 LinkedIn)
  5. Schedule with optimized timing
```

#### **Benefits:**
- ✅ Only best 6 posts selected automatically
- ✅ Topic diversity maintained
- ✅ No duplicate sources
- ✅ No admin review needed

---

### **Phase 3: Optimized Posting Schedule** (Better Engagement)

#### **Current Problem:**
```
User's schedule today:
9am:  Post A (AI topic)
9am:  Post B (AI topic)  ← SAME TIME!
12pm: Post C (Web Dev)
12pm: Post D (Web Dev)   ← SAME TIME!
3pm:  Post E (DevOps)
5pm:  Post F (DevOps)
```

**Issues:**
- Posts compete with each other
- All AI posts at once → followers overwhelmed
- Gaps in afternoon/evening

#### **Proposed Smart Scheduling:**

**Twitter:**
```
8am:  Post A (AI topic)
11am: Post B (Web Dev)
3pm:  Post C (DevOps)
```

**LinkedIn:**
```
9am:  Post D (AI topic)
1pm:  Post E (Web Dev)
5pm:  Post F (DevOps)
```

**Rules:**
1. **Stagger by platform**: Twitter and LinkedIn at different times
2. **Spread evenly**: 3-4 hour gaps minimum
3. **Topic rotation**: Don't post same topic consecutively
4. **Peak times first**: Highest score posts get best times

**Algorithm:**
```typescript
function optimizeSchedule(posts: Post[]): ScheduledPost[] {
  // Sort by quality score (best first)
  posts.sort((a, b) => b.score - a.score)

  const twitterSlots = [8, 11, 15]  // Peak engagement times
  const linkedinSlots = [9, 13, 17]

  const schedule = []
  let lastTopic = null

  for (const post of posts) {
    // Get next available slot
    const slot = post.platform === 'TWITTER'
      ? getNextAvailableSlot(twitterSlots)
      : getNextAvailableSlot(linkedinSlots)

    // Avoid consecutive same topics
    if (post.topic === lastTopic) {
      slot = slot + 1  // Delay by 1 hour
    }

    schedule.push({ post, time: slot })
    lastTopic = post.topic
  }

  return schedule
}
```

---

### **Phase 4: Trending Detection** (Maximum Relevance)

Boost scores for trending topics:

#### **Trending Indicators:**

1. **Keyword Tracking**
   - Monitor mentions of: "GPT-4", "ChatGPT", "Claude", "Gemini", etc.
   - If keyword mentioned > 3 times in last 24h → **Trending**
   - Boost score by +20

2. **Cross-Feed Validation**
   - If same topic appears in 3+ different RSS sources → **Hot topic**
   - Boost score by +15

3. **Recency Multiplier**
   - Published in last 2 hours → **Breaking news**
   - Boost score by +10

4. **Engagement Keywords**
   - "Just announced", "Breaking", "New release" → +10
   - "How to", "Tutorial", "Guide" → +5

**Result:**
Trending AI announcement from TechCrunch:
```
Base score: 70
+ Source authority: 30
+ Trending keyword: 20
+ Breaking news: 10
+ Cross-feed validation: 15
= Final score: 95 → AUTO-APPROVED
```

---

## 📊 Implementation Roadmap

### **Week 1: Database Schema Updates**

Add scoring fields:
```prisma
model Feed {
  // ... existing fields

  qualityScore      Int      @default(0)     // 0-100
  sourceAuthority   Int      @default(50)    // 0-100
  recencyScore      Int      @default(0)     // 0-100
  engagementScore   Int      @default(0)     // 0-100
  relevanceScore    Int      @default(0)     // 0-100
  isTrending        Boolean  @default(false)
  autoApproved      Boolean  @default(false)
  scoredAt          DateTime?
}

model RssFeed {
  // ... existing fields

  authorityScore    Int      @default(50)    // Whitelist: TechCrunch=100
  avgQualityScore   Float?                   // Historical average
}
```

### **Week 2: Scoring Engine**

Create `src/lib/feed-scorer.ts`:
```typescript
export async function scoreFeed(feed: Feed): Promise<number> {
  let score = 0

  // 1. Source authority (30%)
  score += await getSourceAuthorityScore(feed.rssFeedId) * 0.3

  // 2. Recency (25%)
  score += getRecencyScore(feed.publishedAt) * 0.25

  // 3. Content quality (20%)
  score += analyzeContentQuality(feed) * 0.2

  // 4. Engagement potential (15%)
  score += predictEngagement(feed.title, feed.content) * 0.15

  // 5. Topic relevance (10%)
  score += await getTopicRelevance(feed.topicId, feed.content) * 0.1

  // Trending boost
  if (await isTrending(feed)) {
    score += 20
  }

  return Math.min(100, score)
}
```

### **Week 3: Auto-Approval**

Update `feed-processor.ts`:
```typescript
async function addFeedItem(...) {
  // Create feed
  const feed = await prisma.feed.create({ ... })

  // Score it
  const score = await scoreFeed(feed)

  // Auto-approve or reject
  let status = 'PENDING'
  let autoApproved = false

  if (score >= 80) {
    status = 'APPROVED'
    autoApproved = true
    await enqueueApprovedFeed(feed.id, 'AUTO_SYSTEM')
  } else if (score < 60) {
    status = 'REJECTED'
  }

  // Update feed with score and status
  await prisma.feed.update({
    where: { id: feed.id },
    data: { qualityScore: score, status, autoApproved }
  })
}
```

### **Week 4: Smart Selection**

Update `auto-scheduler.ts`:
```typescript
export async function selectAndScheduleDailyPosts(userId: string) {
  // 1. Get all approved feeds for user's topics
  const candidates = await getApprovedFeeds(userId)

  // 2. Sort by quality score
  candidates.sort((a, b) => b.qualityScore - a.qualityScore)

  // 3. Apply diversity rules
  const selected = applyDiversityRules(candidates, {
    maxPerTopic: 2,
    maxPerSource: 1,
    totalPosts: 6
  })

  // 4. Optimize schedule
  const schedule = optimizeSchedule(selected)

  // 5. Create scheduled posts
  for (const item of schedule) {
    await createScheduledPost(userId, item)
  }
}
```

---

## 🎯 Expected Results

### **Before Optimization:**
- ❌ Admin reviews 50 feeds/day manually
- ❌ Selects 6 randomly
- ❌ All posted at same times
- ❌ No quality filtering
- ⏱️ **3 hours/day** admin time

### **After Optimization:**
- ✅ System auto-handles 70% of feeds
- ✅ Admin reviews 15 feeds/day (only borderline cases)
- ✅ Top 6 selected automatically by score
- ✅ Posts distributed evenly throughout day
- ✅ Trending content prioritized
- ⏱️ **30 minutes/day** admin time

### **User Experience:**
- ✅ Better content quality (score ≥ 80)
- ✅ More topic diversity
- ✅ Better posting times
- ✅ Trending topics surfaced faster

---

## 🚀 Quick Wins (This Week)

### **Quick Win #1: Source Whitelist**
Create a trusted source list:
```typescript
const AUTHORITY_SCORES = {
  'techcrunch.com': 100,
  'theverge.com': 95,
  'vercel.com/blog': 100,
  'openai.com/blog': 100,
  'blog.google': 90,
  // ... more
}
```
Auto-approve anything from these sources.

### **Quick Win #2: Recency Boost**
Auto-approve anything published in last 4 hours (breaking news).

### **Quick Win #3: Better Admin UI**
Show score in admin panel:
```
[95] 🔥 OpenAI announces GPT-5 | TechCrunch | 2h ago | AUTO-APPROVED
[75] 📝 React 19 Beta Released | Vercel Blog | 5h ago | PENDING
[45] ❌ Old tutorial from 2020 | Unknown | 3d ago | AUTO-REJECTED
```

---

## 🔧 Configuration Options

### **Admin Settings Page:**

```
Feed Quality Settings:

Auto-Approve Threshold:     [80] (score ≥ 80 auto-approved)
Auto-Reject Threshold:      [60] (score < 60 auto-rejected)
Max Posts Per Topic/Day:    [2]
Max Posts Per Source/Day:   [1]
Enable Trending Boost:      [✓]
Trending Keyword Bonus:     [+20]
Recency Bonus (< 4hrs):     [+15]

Scheduling:
Twitter Peak Times:         [8, 11, 15]
LinkedIn Peak Times:        [9, 13, 17]
Minimum Gap Between Posts:  [3 hours]
```

---

## 📈 Monitoring Dashboard

Add analytics:
```
Feed Quality Metrics (Last 7 Days):

Total Feeds Fetched:        437
Auto-Approved (≥80):        289 (66%)  ← Saved admin time!
Pending Review (60-79):      98 (22%)
Auto-Rejected (<60):         50 (11%)

Average Quality Score:       74.2
Trending Posts Detected:     23

Admin Efficiency:
Time Saved:                  14.5 hours/week
Approval Rate:               89% (admin agrees with auto-approvals)
```

---

## Next Steps

Would you like me to:

1. **Implement Phase 1** (scoring system) right away?
2. **Create the database migration** for new fields?
3. **Build the source authority whitelist** first?
4. **Show you the admin UI mockup** with scores?

Let me know which you'd like to tackle first, and I'll implement it!
