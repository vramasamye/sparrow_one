# 🧪 Test Publishing System

## Quick Test (After Deploying Fix)

### 1. Deploy the Fix
```bash
git add .
git commit -m "fix: add explicit Prisma connection for serverless publishing"
git push
```

### 2. Wait for Vercel Deployment (~1 minute)
Check: https://vercel.com/your-project/deployments

### 3. Test the Cron Endpoint Manually

```bash
# Replace YOUR_DOMAIN and YOUR_SECRET
curl -X GET "https://YOUR_DOMAIN.vercel.app/api/cron/publish-posts?secret=YOUR_CRON_SECRET"
```

**Expected Success Response:**
```json
{
  "success": true,
  "message": "Post publishing completed",
  "timestamp": "2026-01-31T21:30:00.000Z",
  "attempt": 1
}
```

**If it worked, you'll see in Vercel logs:**
```
✅ Prisma connected successfully
✅ Found X posts to publish
✅ Processing posts for user abc123
✅ Successfully published post xyz to TWITTER
✅ Post publishing job completed
```

---

## Check Scheduled Posts Status

### Run Diagnostic Script
```bash
npx tsx scripts/check-scheduled-posts.ts
```

**Example Output:**
```
🔍 Checking Scheduled Posts Status

✅ Database connected

📊 SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Total Scheduled:     5
Due Now:             2 🔴
Publishing:          0
Published:           23
Failed:              1

⚠️  OVERDUE POSTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2026-01-31T21:25:00.000Z (5m ago) - TWITTER - user@example.com
  Content: Check out this amazing AI breakthrough! The latest res...
  ID: clxyz123
```

---

## Manual Database Check

If you have access to the database directly:

```sql
-- Check scheduled posts
SELECT
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE status = 'SCHEDULED') as scheduled,
  COUNT(*) FILTER (WHERE status = 'SCHEDULED' AND "scheduledFor" <= NOW()) as due_now,
  COUNT(*) FILTER (WHERE status = 'PUBLISHED') as published,
  COUNT(*) FILTER (WHERE status = 'FAILED') as failed
FROM scheduled_posts;

-- See next 5 scheduled posts
SELECT
  "scheduledFor",
  platform,
  status,
  LEFT(content, 50) as preview
FROM scheduled_posts
WHERE status = 'SCHEDULED'
ORDER BY "scheduledFor" ASC
LIMIT 5;
```

---

## Troubleshooting

### Issue: No posts found to publish

**Possible Reasons:**
1. No scheduled posts in database yet
2. All posts already published
3. Posts scheduled for future time

**Check:**
```bash
npx tsx scripts/check-scheduled-posts.ts
```

### Issue: Still getting connection errors

**Verify:**
1. Vercel environment variables are set correctly
2. `DATABASE_URL` is accessible from Vercel
3. Database (Neon) is not paused/sleeping

**Test database connection:**
```bash
# In Vercel dashboard
# Go to Settings > Environment Variables
# Verify DATABASE_URL exists
```

### Issue: Posts stuck in PUBLISHING

**Cause:** Previous run crashed mid-publish

**Fix:**
```sql
UPDATE scheduled_posts
SET status = 'SCHEDULED'
WHERE status = 'PUBLISHING'
  AND "updatedAt" < NOW() - INTERVAL '5 minutes';
```

---

## Expected Flow (Successful Publish)

```
1. Cron-job.org triggers endpoint
   ↓
2. Vercel function cold-starts
   ↓
3. Prisma.$connect() ✅ (NEW FIX)
   ↓
4. Find posts where scheduledFor <= now
   ↓
5. Process each post:
   - Update status: PUBLISHING
   - Refresh token if expired
   - Publish to platform
   - Update status: PUBLISHED
   - Add to history
   ↓
6. Prisma.$disconnect() ✅ (NEW FIX)
   ↓
7. Return success response
```

---

## Monitor Production

### Vercel Logs
```bash
vercel logs --follow
```

Filter for publishing:
```bash
vercel logs --follow | grep -i "publish"
```

### Set Up Alerts (Optional)

If you want to be notified of failures:

1. **Add to Vercel Integration:**
   - Go to Vercel Dashboard
   - Integrations → Add Slack/Discord
   - Configure for error notifications

2. **Or use custom webhook:**
   ```typescript
   // In publish-posts/route.ts catch block
   if (lastError) {
     await fetch('YOUR_WEBHOOK_URL', {
       method: 'POST',
       body: JSON.stringify({
         error: lastError.message,
         timestamp: new Date()
       })
     })
   }
   ```

---

## Success Indicators

✅ Vercel logs show "Prisma connected successfully"
✅ Posts change from SCHEDULED → PUBLISHED
✅ Posts appear on Twitter/LinkedIn
✅ User post history updated
✅ Feed status updated to PUBLISHED
✅ No errors in Vercel logs

---

## Quick Commands Reference

```bash
# Test endpoint manually
curl "https://YOUR_DOMAIN.vercel.app/api/cron/publish-posts?secret=SECRET"

# Check post status
npx tsx scripts/check-scheduled-posts.ts

# View Vercel logs
vercel logs --follow

# Deploy changes
git push

# Access database
npx prisma studio
```

---

That's it! The fix should resolve the "Engine is not yet connected" error. 🎉
