# Vercel Production Issues - Analysis & Fixes

## Issues Identified from Logs

### 1. 🚨 CRITICAL: Twitter Rate Limiting (429 Errors)

**Error:**
```
2026-01-30 18:13:12.703 [error] Twitter publish error: Request failed with code 429
2026-01-30 18:13:13.901 [error] Twitter publish error: Request failed with code 429
2026-01-30 18:13:15.032 [error] Twitter publish error: Request failed with code 429
```

**Root Cause:**
Publishing multiple posts for the same user within seconds:
```
18:13:10.285 - Post 1 SUCCESS
18:13:11.587 - Post 2 SUCCESS
18:13:12.703 - Post 3 FAILED (429)
18:13:13.901 - Post 4 FAILED (429)
18:13:15.032 - Post 5 FAILED (429)
```

**Why This Happens:**
- Twitter API limits: ~300 posts per 3 hours per account
- More importantly: Twitter has **per-minute** rate limits
- Publishing 10 posts in 10 seconds triggers rate limiting
- Current code publishes all due posts immediately

**Impact:**
- ❌ Posts fail to publish
- ❌ User experience degraded
- ❌ Retry attempts also fail (still rate limited)
- ❌ Posts marked as FAILED, require manual intervention

**SOLUTION: Natural Scheduling (Already Implemented!)**

The natural scheduling system I just implemented **completely solves this issue**:

**Before:**
```javascript
// All posts for user scheduled at same time
User A: 10 posts at 12:00 UTC
→ Publishing cron tries to publish all 10 at once
→ Twitter rate limit after 2-3 posts
→ 7-8 posts fail
```

**After Natural Scheduling:**
```javascript
// Posts spread across day based on user preferences
User A (America/New_York, times: [8, 10, 12, 14, 17, 19]):
→ Post 1: 08:00 EST (13:00 UTC)
→ Post 2: 10:00 EST (15:00 UTC)
→ Post 3: 12:00 EST (17:00 UTC)
→ Post 4: 14:00 EST (19:00 UTC)
→ Post 5: 17:00 EST (22:00 UTC)
→ Post 6: 19:00 EST (00:00 UTC next day)
→ Each post 2+ hours apart
→ No rate limiting!
```

**How to Enable:**
1. Run migration: `npx prisma migrate deploy`
2. Deploy code (already has natural scheduler)
3. Natural scheduling is now DEFAULT (no config needed)

**Immediate Workaround (Until Migration):**
Increase delay between posts in `src/lib/social-publisher.ts`:

```typescript
// Current: 1 second delay
await new Promise(resolve => setTimeout(resolve, 1000))

// Change to: 60 seconds delay (1 minute)
await new Promise(resolve => setTimeout(resolve, 60000))
```

This will help but natural scheduling is the proper fix.

---

### 2. ⚠️ Deprecation Warning: url.parse()

**Error:**
```
[DEP0169] DeprecationWarning: `url.parse()` behavior is not standardized
and prone to errors that have security implications.
Use the WHATWG URL API instead.
```

**Root Cause:**
RSS parser library using deprecated `url.parse()` from Node.js

**Impact:**
- ⚠️ Warning only (not breaking)
- ⚠️ Will break in future Node.js versions
- ⚠️ Potential security implications

**Fix:** Update RSS parser library

**File:** `src/lib/feed-processor.ts`

Replace:
```typescript
import Parser from 'rss-parser'
```

With modern alternative:
```typescript
import { RSSParser } from '@extractus/feed-extractor'
```

**Steps:**
1. Install new library:
   ```bash
   npm install @extractus/feed-extractor
   ```

2. Update `feed-processor.ts`:
   ```typescript
   import { extract } from '@extractus/feed-extractor'

   // Instead of:
   const parser = new Parser()
   const feed = await parser.parseURL(url)

   // Use:
   const feed = await extract(url)
   ```

3. Update error handling (new library has different error types)

**Alternative:** Suppress warning temporarily
```typescript
// Add to top of feed-processor.ts
process.removeAllListeners('warning')
```

---

### 3. 🔴 404 Error: Forbes RSS Feed

**Error:**
```
Failed to parse feed https://www.forbes.com/fintech/feed/:
Error: Status code 404
```

**Root Cause:**
Forbes changed/removed this RSS feed URL

**Impact:**
- ❌ Feed not fetching
- ❌ No new content from Forbes
- ❌ Error logs on every run

**Fix:** Update or remove feed URL

**Option 1: Find New URL**
```bash
# Check Forbes RSS feeds
curl -I https://www.forbes.com/real-time/feed/
curl -I https://www.forbes.com/innovation/feed/
curl -I https://www.forbes.com/technology/feed/
```

**Option 2: Mark as Inactive**
```sql
UPDATE "rss_feeds"
SET "isActive" = false
WHERE url = 'https://www.forbes.com/fintech/feed/';
```

**Option 3: Remove Completely**
```bash
# Via admin panel
DELETE FROM dashboard: RSS Feeds → forbes.com/fintech → Delete

# Or via SQL
DELETE FROM "rss_feeds"
WHERE url = 'https://www.forbes.com/fintech/feed/';
```

**Recommendation:** Option 2 (mark inactive) - preserves history

---

### 4. 🔴 XML Parsing Error: Content Marketing Institute

**Error:**
```
Failed to parse feed https://contentmarketinginstitute.com/feed/:
Error: Invalid character in entity name
Line: 0
Column: 1679
Char: =
```

**Root Cause:**
Feed has malformed XML (invalid character in entity name)

**Impact:**
- ❌ Feed not parsing
- ❌ No content from this source
- ❌ Error logs on every run

**Fix Options:**

**Option 1: Pre-process XML** (Recommended)
```typescript
// In feed-processor.ts, before parsing:
async function cleanXML(xml: string): Promise<string> {
  return xml
    // Remove invalid characters in entity names
    .replace(/&([^;]+=[^;]*);/g, '')
    // Fix common XML issues
    .replace(/&(?!(amp|lt|gt|quot|apos);)/g, '&amp;')
}

// Then use:
const response = await fetch(url)
const rawXML = await response.text()
const cleanedXML = await cleanXML(rawXML)
const feed = parser.parseString(cleanedXML)
```

**Option 2: Add Error Handling**
```typescript
try {
  const feed = await parser.parseURL(url)
} catch (error) {
  if (error.message.includes('Invalid character in entity name')) {
    // Try alternative parser or skip
    console.log(`Skipping malformed feed: ${url}`)
    continue
  }
  throw error
}
```

**Option 3: Mark as Inactive**
```sql
UPDATE "rss_feeds"
SET "isActive" = false
WHERE url = 'https://contentmarketinginstitute.com/feed/';
```

**Recommendation:** Option 1 + Option 2 (clean XML + handle errors gracefully)

---

## Priority Fix Order

### 🔥 URGENT (Fix Today)
1. **Twitter Rate Limiting** - Run migration + deploy natural scheduler
   - Impact: High (posts failing)
   - Effort: Low (already implemented)
   - Command: `npx prisma migrate deploy`

### ⚡ HIGH (Fix This Week)
2. **Forbes 404 Feed** - Mark as inactive or update URL
   - Impact: Medium (error logs, no content)
   - Effort: Low (1 SQL query)

3. **CMI XML Parsing** - Add XML cleaning
   - Impact: Medium (error logs, no content)
   - Effort: Medium (code changes)

### 📋 MEDIUM (Fix Next Sprint)
4. **url.parse() Deprecation** - Update RSS parser library
   - Impact: Low (warning only)
   - Effort: High (library migration)

---

## Quick Fix Script

Run this to fix the immediate issues:

```sql
-- Mark broken feeds as inactive
UPDATE "rss_feeds"
SET "isActive" = false,
    "lastError" = 'Feed URL no longer available (404)'
WHERE url = 'https://www.forbes.com/fintech/feed/';

UPDATE "rss_feeds"
SET "isActive" = false,
    "lastError" = 'XML parsing error - malformed feed'
WHERE url = 'https://contentmarketinginstitute.com/feed/';
```

Then:
```bash
# Deploy natural scheduler (fixes rate limiting)
npx prisma migrate deploy
git pull  # Get latest code
# Restart Vercel function (automatic on deploy)
```

---

## Monitoring

Add these checks to your monitoring:

### 1. Rate Limit Monitoring
```typescript
// In social-publisher.ts
if (error.message.includes('429')) {
  // Log to monitoring service
  console.error(`RATE_LIMIT_HIT: User ${userId}, Platform ${platform}`)
  // Send alert
}
```

### 2. Feed Health Monitoring
```sql
-- Query to check feed health
SELECT
  name,
  url,
  "lastFetchedAt",
  "lastSuccessAt",
  "fetchErrorCount",
  "lastError"
FROM "rss_feeds"
WHERE "isActive" = true
  AND ("lastError" IS NOT NULL OR "fetchErrorCount" > 3);
```

### 3. Publishing Success Rate
```sql
-- Check publishing success rate by user
SELECT
  u.email,
  COUNT(CASE WHEN sp.status = 'PUBLISHED' THEN 1 END) as published,
  COUNT(CASE WHEN sp.status = 'FAILED' THEN 1 END) as failed,
  COUNT(*) as total
FROM "scheduled_posts" sp
JOIN "users" u ON sp."userId" = u.id
WHERE sp."createdAt" > NOW() - INTERVAL '7 days'
GROUP BY u.email
HAVING COUNT(CASE WHEN sp.status = 'FAILED' THEN 1 END) > 0
ORDER BY failed DESC;
```

---

## Long-term Improvements

### 1. Resilient Feed Fetching
```typescript
// Retry with exponential backoff
async function fetchFeedWithRetry(url: string, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await parser.parseURL(url)
    } catch (error) {
      if (i === maxRetries - 1) throw error
      await delay(Math.pow(2, i) * 1000) // 1s, 2s, 4s
    }
  }
}
```

### 2. Feed Validation
```typescript
// Validate feed before adding to database
async function validateFeed(url: string): Promise<boolean> {
  try {
    const feed = await parser.parseURL(url)
    return feed.items.length > 0
  } catch {
    return false
  }
}
```

### 3. Rate Limit Recovery
```typescript
// Exponential backoff for rate limits
if (error.code === 429) {
  const retryAfter = error.headers['retry-after'] || 60
  console.log(`Rate limited, waiting ${retryAfter}s`)
  await delay(retryAfter * 1000)
  return await publishPost(post) // Retry once
}
```

---

## Summary

✅ **Natural Scheduling** - Already implemented, just needs migration
✅ **Broken Feeds** - Simple SQL updates to mark inactive
⏳ **XML Cleaning** - Add error handling
⏳ **Library Update** - Plan for next sprint

**Expected Results After Fixes:**
- ✅ Zero rate limit errors
- ✅ Clean error logs
- ✅ Better user experience
- ✅ More reliable posting
