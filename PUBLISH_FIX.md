# 🔧 Post Publishing Fix - "Engine is not yet connected"

## Problem

The cron job from cron-job.org was failing with:
```
"Engine is not yet connected"
```

This happens because Vercel serverless functions don't maintain persistent database connections. When the function cold-starts, Prisma hasn't connected yet.

---

## Solution Applied

### 1. Explicit Prisma Connection (src/lib/social-publisher.ts)

**Added:**
```typescript
// CRITICAL: Explicitly connect Prisma in serverless environments (Vercel)
try {
  await prisma.$connect()
  console.log("Prisma connected successfully")
} catch (error) {
  console.error("Failed to connect Prisma:", error)
  throw new Error("Database connection failed")
}
```

**At the end:**
```typescript
// Disconnect Prisma in serverless environments to free resources
await prisma.$disconnect()
```

### 2. Enhanced Retry Logic (src/app/api/cron/publish-posts/route.ts)

**Updated retry conditions:**
```typescript
if (attempt < 3 && (
  lastError.message.includes("Can't reach database") ||
  lastError.message.includes("Engine is not yet connected") ||
  lastError.message.includes("Database connection failed")
)) {
  console.log(`Waiting 3 seconds before retry ${attempt + 1}...`)
  await new Promise(resolve => setTimeout(resolve, 3000))
}
```

Now retries specifically on connection errors with 3-second delay.

---

## How to Verify the Fix

### Option 1: Check Scheduled Posts Status

```bash
npx tsx scripts/check-scheduled-posts.ts
```

This will show:
- Total scheduled posts
- Posts due now (should be published)
- Upcoming posts (next 24 hours)
- Recent failures
- Stuck posts

### Option 2: Check Vercel Logs

After the next cron run:

```bash
vercel logs --follow
```

Look for:
```
✅ "Prisma connected successfully"
✅ "Found X posts to publish"
✅ "Post publishing job completed"
```

### Option 3: Trigger Cron Manually

Test the endpoint directly:

```bash
# Replace YOUR_SECRET with your actual CRON_SECRET
curl https://your-domain.vercel.app/api/cron/publish-posts?secret=YOUR_SECRET
```

Expected response:
```json
{
  "success": true,
  "message": "Post publishing completed",
  "timestamp": "2026-01-31T...",
  "attempt": 1
}
```

---

## Diagnostic Commands

### Check if there are scheduled posts in the database:

```sql
-- Via Prisma Studio
npx prisma studio

-- Or via SQL (if you have direct access)
SELECT
  COUNT(*) FILTER (WHERE status = 'SCHEDULED') as scheduled,
  COUNT(*) FILTER (WHERE status = 'SCHEDULED' AND "scheduledFor" <= NOW()) as overdue,
  COUNT(*) FILTER (WHERE status = 'PUBLISHING') as publishing,
  COUNT(*) FILTER (WHERE status = 'FAILED') as failed
FROM scheduled_posts;
```

### Find overdue posts:

```sql
SELECT
  id,
  "userId",
  platform,
  "scheduledFor",
  status,
  "errorMessage",
  "retryCount",
  LEFT(content, 60) as content_preview
FROM scheduled_posts
WHERE status = 'SCHEDULED'
  AND "scheduledFor" <= NOW()
ORDER BY "scheduledFor" ASC
LIMIT 10;
```

---

## Understanding the Flow

### 1. Cron Job Trigger (cron-job.org)
```
Every 1 minute → https://your-domain.vercel.app/api/cron/publish-posts?secret=XXX
```

### 2. API Route Handler
```
/api/cron/publish-posts/route.ts
  ↓
  Retry logic (3 attempts)
  ↓
  publishScheduledPosts()
```

### 3. Publisher Function
```
social-publisher.ts
  ↓
  await prisma.$connect() ← FIX ADDED HERE
  ↓
  Find posts due (scheduledFor <= now)
  ↓
  Process each post sequentially
  ↓
  await prisma.$disconnect()
```

### 4. Post Processing
```
processSinglePost()
  ↓
  Update status: PUBLISHING
  ↓
  Check/refresh token if expired
  ↓
  Publish to Twitter/LinkedIn
  ↓
  Update status: PUBLISHED (or FAILED)
  ↓
  Add to post history
  ↓
  Update feed status
```

---

## Common Issues & Solutions

### Issue: "No posts to publish" but there should be

**Check:**
1. Time zone mismatch between cron and database
2. Posts stuck in PUBLISHING state
3. Posts already marked as FAILED

**Solution:**
```bash
npx tsx scripts/check-scheduled-posts.ts
```

### Issue: Posts stuck in PUBLISHING state

**Cause:** Previous run crashed mid-publish

**Solution:**
```sql
-- Reset stuck posts (older than 5 minutes)
UPDATE scheduled_posts
SET status = 'SCHEDULED'
WHERE status = 'PUBLISHING'
  AND "updatedAt" < NOW() - INTERVAL '5 minutes';
```

### Issue: Token expired errors

**Check:**
```sql
SELECT
  id,
  platform,
  "platformUsername",
  "tokenExpiresAt",
  "lastTokenRefresh",
  "isActive"
FROM social_accounts
WHERE "tokenExpiresAt" < NOW();
```

**Solution:** User needs to reconnect their account

---

## Testing Checklist

After deploying the fix:

- [ ] Wait for next cron run (max 1 minute)
- [ ] Check Vercel logs for "Prisma connected successfully"
- [ ] Verify posts are being published
- [ ] Check for any errors in logs
- [ ] Run diagnostic script to see status
- [ ] Verify no posts stuck in PUBLISHING
- [ ] Check published posts appear in user feeds

---

## Monitoring

### Vercel Dashboard
1. Go to your Vercel project
2. Click "Logs" tab
3. Filter by `/api/cron/publish-posts`
4. Look for errors

### Database Monitoring
```bash
# Run this periodically
npx tsx scripts/check-scheduled-posts.ts
```

### Set up alerts (optional)
If posts fail consistently, you might want to:
1. Add error tracking (e.g., Sentry)
2. Set up monitoring (e.g., Better Stack)
3. Add webhook notifications on failures

---

## Files Changed

1. ✅ `src/lib/social-publisher.ts` - Added explicit $connect() and $disconnect()
2. ✅ `src/app/api/cron/publish-posts/route.ts` - Enhanced retry logic
3. ✅ `scripts/check-scheduled-posts.ts` - New diagnostic script

---

## Next Steps

1. **Deploy to Vercel:**
   ```bash
   git add .
   git commit -m "fix: add explicit Prisma connection for serverless publishing"
   git push
   ```

2. **Wait for cron run** (max 1 minute)

3. **Check logs:**
   ```bash
   vercel logs --follow
   ```

4. **Verify posts published:**
   ```bash
   npx tsx scripts/check-scheduled-posts.ts
   ```

---

## Expected Behavior After Fix

### Before (Error):
```
❌ Engine is not yet connected
❌ Post publishing failed
```

### After (Success):
```
✅ Prisma connected successfully
✅ Found 3 posts to publish
✅ Processing posts for user abc123
✅ Successfully published post xyz to TWITTER
✅ Post publishing job completed
```

---

## Support

If the issue persists:

1. Check Vercel logs for specific errors
2. Run diagnostic script to see post status
3. Verify database connection string in Vercel env vars
4. Check if Neon database is active (not paused)
5. Verify cron job is hitting the correct URL with correct secret

The fix addresses the root cause (missing explicit connection in serverless), so the publishing should work reliably now! 🚀
