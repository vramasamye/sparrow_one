# Scoring System Improvements

## Problem Identified

The previous scoring system had major flaws:

### Example Cases:
- **Robot vacuum review:** 46% relevant ❌
- **SpaceX/Tesla/xAI merger (TechCrunch):** 26% relevant, auto-rejected ❌

This is backwards! Tech news should score higher than product reviews.

## Root Causes

1. **Source Authority Mismatch**
   - TechCrunch should get 20/20 points
   - Was only getting 10/20 due to subdomain handling
   - `feeds.techcrunch.com` not matching `techcrunch.com`

2. **Auto-Reject Threshold Too Strict**
   - Threshold was 60/100
   - Good tech news scoring 50-60 was rejected
   - Product reviews scoring 40-50 were pending review

3. **No Content Relevance Scoring**
   - Product reviews vs tech news treated equally
   - Listicles ("10 best...") not penalized
   - High-value keywords (merger, acquisition, AI) not rewarded

4. **Moderation Boost Too Weak**
   - Only +0 to +10 points for safe content
   - Not enough to offset low rule-based scores

## Solutions Implemented

### 1. Improved Domain Extraction ✅

**Before:**
```typescript
parsed.hostname.replace('www.', '')
// feeds.techcrunch.com → feeds.techcrunch.com ❌
```

**After:**
```typescript
hostname
  .replace('www.', '')
  .replace('feeds.', '')
  .replace('blog.', '')
  .replace('news.', '')
// feeds.techcrunch.com → techcrunch.com ✅
```

### 2. Expanded Source Authority List ✅

**Added:**
- Business/Finance tech coverage (Bloomberg, Reuters, WSJ) - 19 points
- More premier tech sites (Engadget, VentureBeat, CNET) - 20 points
- Industry publications (SiliconAngle, ZDNet) - 16 points

**Before:** 10 sources
**After:** 25+ sources with granular scoring

### 3. New Content Relevance Scoring (0-15 points) ✅

```typescript
function getContentRelevanceScore(feed): number {
  let score = 5  // Base score

  // HIGH VALUE: Tech news keywords (+10)
  if (mentions('merger', 'acquisition', 'funding', 'AI', etc.)) {
    score += 10
  }

  // MEDIUM VALUE: Company names (+5)
  if (mentions('Apple', 'Google', 'Tesla', 'SpaceX', etc.)) {
    score += 5
  }

  // PENALTY: Product reviews (-15)
  if (title includes 'best', 'top', 'review', 'buying guide') {
    score -= 15
  }

  // PENALTY: Listicles (-10)
  if (title matches '10 best...', '5 ways...') {
    score -= 10
  }

  // BONUS: Timely (+3)
  if (includes 'breaking', 'just', 'latest') {
    score += 3
  }

  return clamp(0, 15, score)
}
```

### 4. Adjusted Scoring Weights ✅

**Before:**
- Source Authority: 0-20
- Recency: 0-15
- Metadata: 0-15
- **Total: 0-50 (rule-based)**
- Moderation: -50 to +10
- **Final: 0-100**

**After:**
- Source Authority: 0-20
- Recency: 0-15
- Metadata: 0-10 (reduced)
- Content Relevance: 0-15 (NEW!)
- **Total: 0-60 (rule-based)**
- Moderation: -60 to +25 (increased boost)
- **Final: 0-100**

### 5. Lowered Auto-Thresholds ✅

**Auto-Reject:**
- Before: < 60 (too strict)
- After: < 40 (more reasonable)

**Auto-Approve:**
- Before: ≥ 80
- After: ≥ 75 (slightly easier)

### 6. Improved Moderation Boost ✅

**Before:**
```typescript
moderationBoost = (confidence - 0.5) * 20
// 0.5 confidence → +0 points
// 0.8 confidence → +6 points
// 1.0 confidence → +10 points
```

**After:**
```typescript
moderationBoost = (confidence - 0.5) * 50
// 0.5 confidence → +0 points
// 0.8 confidence → +15 points
// 1.0 confidence → +25 points
```

## Expected Results

### Before Improvements:

**SpaceX/Tesla/xAI Merger (TechCrunch):**
- Source: 10/20 (missed TechCrunch)
- Recency: 7/15
- Metadata: 7/15
- Relevance: N/A
- Rule-based: 24/50
- Moderation: +6 (confidence 0.8)
- **Final: 30/100 → AUTO-REJECTED** ❌

**Robot Vacuum Review:**
- Source: 10/20
- Recency: 10/15
- Metadata: 10/15
- Relevance: N/A
- Rule-based: 30/50
- Moderation: +16
- **Final: 46/100 → PENDING REVIEW** ❌

---

### After Improvements:

**SpaceX/Tesla/xAI Merger (TechCrunch):**
- Source: 20/20 ✅ (TechCrunch recognized)
- Recency: 7/15
- Metadata: 7/10
- Relevance: 15/15 ✅ (merger + Tesla/SpaceX keywords)
- Rule-based: 49/60
- Moderation: +15 (confidence 0.8)
- **Final: 64/100 → PENDING REVIEW** ✅
- (Can be approved manually or will auto-approve with slightly higher confidence)

**Robot Vacuum Review:**
- Source: 10/20
- Recency: 10/15
- Metadata: 7/10
- Relevance: 0/15 ❌ (product review penalty -15)
- Rule-based: 27/60
- Moderation: +15
- **Final: 42/100 → PENDING REVIEW** ⚠️
- (Barely above auto-reject threshold, likely rejected manually)

## Key Improvements

1. ✅ **TechCrunch properly recognized** - Domain extraction fixed
2. ✅ **Tech news rewarded** - Content relevance scoring
3. ✅ **Product reviews penalized** - Relevance penalty
4. ✅ **Listicles penalized** - Pattern matching
5. ✅ **Auto-reject threshold lowered** - Good content not auto-rejected
6. ✅ **Moderation boost increased** - High confidence gets bigger boost

## Score Distribution

### Expected Distribution After Improvements:

| Content Type | Typical Score | Outcome |
|--------------|---------------|---------|
| Premier tech news (breaking) | 75-90 | Auto-Approve ✅ |
| Good tech news | 60-75 | Pending Review ⚠️ |
| Product reviews | 35-45 | Auto-Reject ❌ |
| Listicles | 25-40 | Auto-Reject ❌ |
| Sales content | 0-30 | Auto-Reject ❌ |
| Unsafe content | 0-20 | Auto-Reject ❌ |

## Testing

Test with these examples:

```bash
# Should score HIGH (75+):
- "OpenAI announces GPT-5 with breakthrough capabilities" (TechCrunch)
- "Tesla and SpaceX merger talks confirmed by sources" (Reuters)
- "Google acquires AI startup for $2B" (The Verge)

# Should score MEDIUM (50-75):
- "New study shows AI impact on job market" (Wired)
- "Startup raises $10M Series A for developer tools" (TechCrunch)

# Should score LOW (< 40, auto-reject):
- "Best robot vacuums to buy in 2026" (CNET)
- "10 top productivity apps for developers" (Medium)
- "Limited time offer: 50% off AI course" (Spam)
```

## Migration

No database migration needed - scoring logic only!

Just deploy and existing feeds will be re-scored with new algorithm when:
1. New feeds are processed
2. Manual re-scoring triggered
3. Batch scoring runs

## Monitoring

Watch these metrics after deployment:

```sql
-- Auto-approval rate (should increase)
SELECT
  COUNT(CASE WHEN "autoApproved" = true THEN 1 END) * 100.0 / COUNT(*) as approval_rate
FROM feeds
WHERE "scoredAt" > NOW() - INTERVAL '7 days';

-- Average quality score (should be similar, distribution different)
SELECT AVG("qualityScore") FROM feeds
WHERE "scoredAt" > NOW() - INTERVAL '7 days';

-- Score distribution
SELECT
  CASE
    WHEN "qualityScore" >= 75 THEN '75-100 (Auto-Approve)'
    WHEN "qualityScore" >= 60 THEN '60-74 (Good)'
    WHEN "qualityScore" >= 40 THEN '40-59 (Medium)'
    ELSE '0-39 (Auto-Reject)'
  END as score_range,
  COUNT(*) as count
FROM feeds
WHERE "scoredAt" > NOW() - INTERVAL '7 days'
GROUP BY score_range
ORDER BY MIN("qualityScore") DESC;
```

## Success Criteria

After 1 week:
- ✅ Tech news auto-approval rate > 50%
- ✅ Product review auto-rejection rate > 80%
- ✅ Manual review queue reduced by 30%
- ✅ Zero complaints about good content being rejected
- ✅ Average quality score for tech news > 70

## Files Modified

- `src/lib/feed-scorer.ts` - Complete scoring overhaul
- `docs/SCORING_IMPROVEMENTS.md` - This document
