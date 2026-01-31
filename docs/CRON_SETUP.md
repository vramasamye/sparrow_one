# Cron Job Setup Guide

This guide explains how to set up automated cron jobs for Sparrow using cron-job.org.

## Available Strategies

Sparrow supports three cron strategies, each optimized for different use cases. All strategies stay well under the 5,000 runs/day limit (cron-job.org free tier).

### 🎯 Balanced (Recommended)
**1,574 runs/day** - Optimal balance with full automation

```bash
npm run setup-cron:balanced
```

**Automated Jobs:**
- 📤 Publish Posts: Every 1 minute (1,440/day) - sequential per user
- ⚙️  Process Queue: Every 20 minutes (72/day)
- 🎯 Score Feeds: Every 30 minutes (48/day)
- 📥 Feed Processing: Every 2 hours (12/day)
- 🔄 Refresh Tokens: Daily at midnight (1/day)
- 🗑️  Cleanup: Daily at 3am (1/day)

**Best for:**
- Complete hands-off automation
- Instant post publishing (within 1 minute)
- Fast queue processing (~13 hours to clear 38 feeds)
- Regular RSS feed updates (every 2 hours)
- Most users

---

### 💡 Light
**1,522 runs/day** - Lighter automation with less frequent updates

```bash
npm run setup-cron:light
```

**Automated Jobs:**
- 📤 Publish Posts: Every 1 minute (1,440/day) - sequential per user
- ⚙️  Process Queue: Every 30 minutes (48/day)
- 🎯 Score Feeds: Every 1 hour (24/day)
- 📥 Feed Processing: Every 3 hours (8/day)
- 🔄 Refresh Tokens: Daily at midnight (1/day)
- 🗑️  Cleanup: Daily at 3am (1/day)

**Best for:**
- Instant post publishing (within 1 minute)
- Moderate queue processing (~19 hours to clear 38 feeds)
- Less frequent RSS updates (every 3 hours)
- Lower resource usage
- Testing and development

---

### 🚀 Full Automation
**1,514 runs/day** - Maximum automation for enterprise

```bash
npm run setup-cron:full
```

**Automated Jobs:**
- 📤 Publish Posts: Every 1 minute (1,440/day) - sequential per user
- 🎯 Score Feeds: Every 30 minutes (48/day)
- ⚙️  Process Queue: Every 2 hours (12/day)
- 📥 Feed Processing: Every 2 hours (12/day)
- 🔄 Refresh Tokens: Daily at 12:30am UTC (1/day)
- 🗑️  Cleanup: Daily at 3:00am UTC (1/day)

**Best for:**
- Slowest queue processing but most reliable (~76 hours to clear 38 feeds)
- Even load distribution across the day
- Instant post publishing (within 1 minute)
- Set it and forget it
- Enterprise deployments

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

## Manual Testing

You can manually trigger any cron job for testing by visiting these URLs (replace `YOUR_SECRET` with your `CRON_SECRET`):

```
# Publish Posts
https://your-app.vercel.app/api/cron/publish-posts?secret=YOUR_SECRET

# Process Queue
https://your-app.vercel.app/api/cron/process-queue?secret=YOUR_SECRET

# Score Feeds
https://your-app.vercel.app/api/cron/score-feeds?secret=YOUR_SECRET

# Feed Processing
https://your-app.vercel.app/api/cron/process-feeds?secret=YOUR_SECRET

# Refresh Tokens
https://your-app.vercel.app/api/cron/refresh-tokens?secret=YOUR_SECRET

# Cleanup
https://your-app.vercel.app/api/cron/cleanup?secret=YOUR_SECRET
```

---

## Strategy Comparison

| Feature | Balanced | Light | Full |
|---------|----------|-------|------|
| **Runs/day** | 1,574 | 1,522 | 1,514 |
| **Post publishing** | Every 1 min | Every 1 min | Every 1 min |
| **Queue processing** | Every 20 min | Every 30 min | Every 2 hrs |
| **Feed scoring** | Every 30 min | Every 1 hr | Every 30 min |
| **RSS fetching** | Every 2 hrs | Every 3 hrs | Every 2 hrs |
| **Token refresh** | Daily | Daily | Daily |
| **Cleanup** | Daily | Daily | Daily |
| **Queue speed** | Fast (13 hrs) | Medium (19 hrs) | Slow (76 hrs) |
| **Post delay** | Max 1 min | Max 1 min | Max 1 min |
| **RSS refresh** | Every 2 hrs | Every 3 hrs | Every 2 hrs |
| **Publishing** | Sequential per user | Sequential per user | Sequential per user |
| **Automation** | Full | Full | Full |
| **Maintenance** | None | None | None |

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

**Q: Are all jobs fully automated now?**
A: Yes! All three strategies now include full automation for all jobs (publishing, processing, scoring, RSS fetching, token refresh, and cleanup).

**Q: What if I exceed 5,000 runs/day?**
A: Cron-job.org free tier allows 5,000 runs/day. All strategies stay well under this limit (~1,500-1,600/day). Monitor your usage in the console.

**Q: How do I test a cron job?**
A: Click "Run now" in cron-job.org, or paste the URL in your browser.

**Q: Can I use a different cron service?**
A: Yes! All endpoints support standard GET requests with `?secret=YOUR_SECRET` parameter.

---

## Support

- Issues: https://github.com/your-repo/issues
- Documentation: /docs
- Cron-job.org Docs: https://docs.cron-job.org
