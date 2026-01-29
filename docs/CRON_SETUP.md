# Cron Job Setup Guide

This guide explains how to set up automated cron jobs for Sparrow using cron-job.org.

## Available Strategies

Sparrow supports three cron strategies, each optimized for different use cases while staying within the 100 runs/day limit.

### 🎯 Balanced (Recommended)
**96 runs/day** - Optimal balance between automation and manual control

```bash
npm run setup-cron:balanced
```

**Automated Jobs:**
- ⚙️  Process Queue: Every 20 minutes (72/day)
- 📤 Publish Posts: Every 1 hour (24/day)

**Manual Jobs:**
- 📥 Feed Processing: Run when you want fresh RSS articles
- 🔄 Refresh Tokens: Run weekly to keep OAuth tokens fresh
- 🗑️  Cleanup: Run monthly to clean up old data

**Best for:**
- Fast queue processing (~13 hours to clear 38 feeds)
- Posts publish within 1 hour of schedule
- Manual control over RSS fetching
- Most users

---

### 💡 Light
**48 runs/day** - Minimal automation for manual workflow

```bash
npm run setup-cron:light
```

**Automated Jobs:**
- ⚙️  Process Queue: Every 30 minutes (48/day)
- 📤 Publish Posts: Every 1 hour at :15 (24/day)

**Manual Jobs:**
- 📥 Feed Processing: Manual only
- 🔄 Refresh Tokens: Manual only
- 🗑️  Cleanup: Manual only

**Best for:**
- Users who prefer manual control
- Lower resource usage
- Testing and development

---

### 🚀 Full Automation
**50 runs/day** - Complete hands-off automation

```bash
npm run setup-cron:full
```

**Automated Jobs:**
- ⚙️  Process Queue: Every 2 hours (12/day)
- 📤 Publish Posts: Every 1 hour at :15 (24/day)
- 📥 Feed Processing: Every 2 hours (12/day)
- 🔄 Refresh Tokens: Daily at 12:30am UTC (1/day)
- 🗑️  Cleanup: Daily at 3:00am UTC (1/day)

**Best for:**
- Completely automated operation
- Set it and forget it
- Users who don't want to manage cron jobs

---

## Quick Start

### 1. Prerequisites

Set up your environment variables in `.env.local`:

```env
CRON_JOB_ORG_API_KEY=your_api_key_here
CRON_SECRET=your_cron_secret_here
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

**Get your cron-job.org API key:**
1. Go to https://console.cron-job.org
2. Settings → API
3. Generate API key

### 2. Choose Your Strategy

Run one of these commands:

```bash
# Balanced (recommended)
npm run setup-cron:balanced

# Light (minimal automation)
npm run setup-cron:light

# Full (complete automation)
npm run setup-cron:full

# Default (uses balanced)
npm run setup-cron
```

### 3. Verify Setup

1. Visit https://console.cron-job.org
2. Check that jobs were created/updated
3. Verify schedules match your chosen strategy
4. Click "Run now" to test each job

---

## Manual Job URLs

For manual jobs, bookmark these URLs (replace `YOUR_SECRET` with your `CRON_SECRET`):

### Feed Processing
Fetch new RSS articles from all active feeds.

```
https://your-app.vercel.app/api/cron/process-feeds?secret=YOUR_SECRET
```

**When to run:** 2-4 times per day (morning, afternoon, evening, night)

### Refresh Tokens
Refresh expiring OAuth tokens (Twitter, LinkedIn).

```
https://your-app.vercel.app/api/cron/refresh-tokens?secret=YOUR_SECRET
```

**When to run:** Once per week (tokens typically last 30+ days)

### Cleanup
Remove old rejected/pending feeds and cleanup database.

```
https://your-app.vercel.app/api/cron/cleanup?secret=YOUR_SECRET
```

**When to run:** Once per month

---

## Strategy Comparison

| Feature | Balanced | Light | Full |
|---------|----------|-------|------|
| **Runs/day** | 96 | 48 | 50 |
| **Queue processing** | Every 20 min | Every 30 min | Every 2 hrs |
| **Post publishing** | Every 1 hr | Every 1 hr | Every 1 hr |
| **RSS fetching** | Manual | Manual | Automated |
| **Token refresh** | Manual | Manual | Automated |
| **Cleanup** | Manual | Manual | Automated |
| **Queue speed** | Fast (13 hrs) | Medium (19 hrs) | Slow (76 hrs) |
| **Post delay** | Max 1 hr | Max 1 hr | Max 1 hr |
| **Maintenance** | Low | Low | None |

---

## Switching Strategies

You can switch strategies at any time by running the setup script again:

```bash
# Currently using Light, want to switch to Balanced
npm run setup-cron:balanced
```

**What happens:**
- Existing jobs are updated (not duplicated)
- Schedules change to match new strategy
- Jobs are matched by title (e.g., "Sparrow - Process Queue")

---

## Monitoring

### Check Job Status

Visit https://console.cron-job.org to:
- View execution history
- Check success/failure rates
- See response times
- View error messages

### Common Issues

**401 Unauthorized**
- Check `CRON_SECRET` in `.env.local` matches the URL parameter
- Verify URL includes `?secret=YOUR_SECRET`

**500 Internal Server Error**
- Check Vercel deployment logs
- Verify all environment variables are set in Vercel
- Check Redis, Prisma, and API integrations

**Job not running**
- Verify job is enabled in cron-job.org
- Check schedule is correct
- Ensure you haven't hit the 100 runs/day limit

---

## Advanced Usage

### Custom Strategy

You can create a custom strategy by modifying `src/lib/cron-job-org.ts`:

```typescript
case 'custom':
  return {
    name: 'Custom',
    description: 'Your custom strategy',
    totalRuns: 80,
    jobs: {
      processQueue: {
        enabled: true,
        schedule: {
          timezone: 'UTC',
          hours: [-1],
          minutes: [0, 15, 30, 45], // Every 15 minutes
          mdays: [-1],
          months: [-1],
          wdays: [-1]
        }
      },
      // ... other jobs
    }
  }
```

Then run:
```bash
npx tsx scripts/setup-cron.ts custom
```

### Delete All Jobs

To remove all cron jobs:

```bash
# Via cron-job.org console
# Or use the management API endpoint
curl -X DELETE "https://your-app.vercel.app/api/cron/manage?jobId=123&secret=YOUR_SECRET"
```

---

## FAQ

**Q: Can I mix manual and automated strategies?**
A: Yes! Choose `balanced` or `light`, then manually run the automated jobs when needed.

**Q: What if I exceed 100 runs/day?**
A: Cron-job.org will stop executing jobs until the next day. Monitor your usage in the console.

**Q: How do I test a cron job?**
A: Click "Run now" in cron-job.org, or paste the URL in your browser.

**Q: Can I use a different cron service?**
A: Yes! All endpoints support standard GET requests with `?secret=YOUR_SECRET` parameter.

---

## Support

- Issues: https://github.com/your-repo/issues
- Documentation: /docs
- Cron-job.org Docs: https://docs.cron-job.org
