# Cron Troubleshooting Guide

## Issue: Publish-Posts works manually but fails automatically

### Step 1: Check cron-job.org Execution History

1. Go to https://console.cron-job.org
2. Find "Sparrow - Publish Posts" job
3. Click on it to see execution history
4. Look at the failed executions

**What to check:**
- ❌ **401 Unauthorized** - Secret is missing or incorrect
- ❌ **500 Internal Server Error** - Code error (check Vercel logs)
- ❌ **Timeout** - Job taking too long (>60 seconds)
- ✅ **200 OK** - Success

---

### Step 2: Verify the URL in cron-job.org

The URL should look like:
```
https://your-app.vercel.app/api/cron/publish-posts?secret=YOUR_CRON_SECRET
```

**Common issues:**
- ❌ Missing `?secret=...` parameter
- ❌ Wrong secret value
- ❌ Extra spaces in URL
- ❌ Using `http://` instead of `https://`

**How to fix:**
1. Edit the cron job in cron-job.org
2. Copy the correct URL from your manual test
3. Save and test

---

### Step 3: Check Vercel Logs

1. Go to Vercel Dashboard → Your Project → Logs
2. Filter by time when the cron failed
3. Look for errors related to `/api/cron/publish-posts`

**Common errors:**
- `CRON_SECRET not configured` - Missing env variable
- `Unauthorized` - Secret mismatch
- Twitter/LinkedIn API errors - Token issues

---

### Step 4: Compare Manual vs Automatic

**Manual run (works):**
- You paste URL in browser with `?secret=...`
- Uses GET request
- Secret in query parameter

**Automatic run (fails):**
- cron-job.org sends GET request
- Should also have `?secret=...` in URL
- If missing, auth will fail

---

### Step 5: Verify Environment Variables

In Vercel Dashboard → Settings → Environment Variables:

Required:
- ✅ `CRON_SECRET` - Must match the secret in your cron URL
- ✅ All other env vars (Twitter, LinkedIn, etc.)

**Test:**
```bash
# In your local terminal
echo $CRON_SECRET

# Should match what's in Vercel and cron-job.org URL
```

---

## Quick Fixes

### Fix 1: Re-create the cron job with correct URL

If you manually created the cron job, it might be missing the secret:

```bash
# Run the setup script to update/create jobs properly
npm run setup-cron:balanced
```

This will create jobs with the correct URL format including the secret.

---

### Fix 2: Manually update the URL

1. Go to cron-job.org
2. Edit "Sparrow - Publish Posts"
3. Update URL to:
   ```
   https://your-domain.vercel.app/api/cron/publish-posts?secret=YOUR_ACTUAL_SECRET
   ```
4. Save
5. Click "Run now" to test

---

### Fix 3: Check for duplicate jobs

Sometimes multiple jobs exist with the same name:

1. Go to cron-job.org
2. List all jobs
3. Delete any duplicate "Sparrow - Publish Posts" jobs
4. Keep only one with correct URL

---

## Verification Checklist

After fixing:
- [ ] URL includes `?secret=...` parameter
- [ ] Secret matches `CRON_SECRET` in Vercel env vars
- [ ] Job is enabled in cron-job.org
- [ ] Schedule is correct (every 1 hour)
- [ ] Manual test works (click "Run now")
- [ ] Wait for next automatic run
- [ ] Check execution history shows 200 OK

---

## Still Having Issues?

### Enable detailed logging

Add this to your Vercel logs:

1. Go to `/api/cron/publish-posts/route.ts`
2. The route already has logging - check Vercel logs for:
   - "Post publishing cron job started"
   - Any error messages

### Check specific error details

Share these details for further help:
1. Exact error message from cron-job.org
2. Exact error from Vercel logs (with timestamp)
3. The URL you're using in cron-job.org (hide the secret)
4. Screenshot of cron job configuration

---

## Most Common Root Cause

**95% of the time it's one of these:**

1. ❌ Cron job URL is missing `?secret=...`
2. ❌ Wrong secret value (typo or old value)
3. ❌ CRON_SECRET not set in Vercel environment variables
4. ❌ Using wrong domain (staging vs production)

**The fix:**
```bash
npm run setup-cron:balanced
```

This creates jobs with correct URLs automatically.
