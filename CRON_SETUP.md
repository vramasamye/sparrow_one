# Cron Job Setup with cron-job.org

This application uses [cron-job.org](https://cron-job.org) for scheduled task execution instead of Vercel's built-in cron jobs.

## Why cron-job.org?

- **Free tier**: 100 API requests per day
- **Reliable**: Dedicated cron service with monitoring
- **Flexible**: Easy to manage and monitor via web console
- **No Vercel limitations**: Works with any hosting provider
- **Multiple schedules**: Run different tasks at optimal frequencies

## Architecture

The system uses **5 separate cron jobs**, each optimized for its task:

| Job | Schedule | Triggers/Day | Purpose |
|-----|----------|--------------|---------|
| **Feed Processing** | Every 2 hours | 12 | Fetch new articles from RSS feeds |
| **Publish Posts** | Every hour | 24 | Publish scheduled social media posts |
| **Process Queue** | Every 2 hours | 12 | Generate AI posts from approved feeds |
| **Refresh Tokens** | Once daily | 1 | Refresh social media OAuth tokens |
| **Cleanup** | Once daily | 1 | Remove old pending feeds |
| **TOTAL** | - | **50** | Under 100/day limit ✓ |

This architecture:
- Stays well under the 100 trigger/day limit (50% utilization)
- Runs high-priority tasks (publishing) more frequently
- Runs maintenance tasks (cleanup, tokens) only when needed
- Distributes load across the day to avoid timeouts

## Setup Instructions

### 1. Create a cron-job.org Account

1. Visit [cron-job.org](https://cron-job.org) and create a free account
2. Go to [Console Settings](https://console.cron-job.org/settings)
3. Generate an API key under the "API" section
4. Copy the API key - you'll need it for the next step

### 2. Configure Environment Variables

Add the following to your `.env.local` file (and your deployment environment):

```bash
# cron-job.org API Key
CRON_JOB_ORG_API_KEY=your_api_key_here

# CRON_SECRET for authenticating incoming cron requests (keep existing value)
CRON_SECRET=your_existing_cron_secret

# Your application URL (Vercel provides this automatically in production)
NEXT_PUBLIC_APP_URL=https://your-app.vercel.app
```

**Vercel Environment Variables:**
1. Go to your Vercel project settings
2. Navigate to Environment Variables
3. Add `CRON_JOB_ORG_API_KEY` with your API key
4. Ensure `CRON_SECRET` is already set
5. `NEXT_PUBLIC_APP_URL` is automatically available as `VERCEL_URL`

### 3. Run the Setup Script

After deploying your application, run:

```bash
npm run setup-cron
```

This script will:
- Validate your environment variables
- Create **5 separate cron jobs** on cron-job.org
- Configure each with its optimal schedule
- Set up authentication using your CRON_SECRET
- Display all created job IDs

**Expected Output:**
```
Creating 5 separate cron jobs with optimized schedules...

📥 Setting up Feed Processing cron...
✓ Created (ID: 12345)

📤 Setting up Publish Posts cron...
✓ Created (ID: 12346)

⚙️  Setting up Process Queue cron...
✓ Created (ID: 12347)

🔄 Setting up Refresh Tokens cron...
✓ Created (ID: 12348)

🗑️  Setting up Cleanup cron...
✓ Created (ID: 12349)

✓ Setup completed successfully!

Total triggers per day: 50 (under 100 limit) ✓
```

### 4. Verify Setup

1. Visit [cron-job.org Console](https://console.cron-job.org)
2. Check that all 5 jobs are listed:
   - Sparrow - Feed Processing
   - Sparrow - Publish Posts
   - Sparrow - Process Queue
   - Sparrow - Refresh Tokens
   - Sparrow - Cleanup
3. Verify each job is **enabled** and scheduled correctly
4. Monitor the first execution of each job

## How It Works

Each cron job sends a GET request to its specific endpoint with authentication:

### 1. Feed Processing (Every 2 hours)
```
GET https://your-app.vercel.app/api/cron/process-feeds?secret=YOUR_SECRET
```
- Fetches new articles from RSS feeds
- First pull: Gets all January 2026 articles
- Subsequent pulls: Gets articles since last fetch
- Deduplicates using content hash
- Cleans up old pending feeds

### 2. Publish Posts (Every hour)
```
GET https://your-app.vercel.app/api/cron/publish-posts?secret=YOUR_SECRET
```
- Publishes scheduled posts due for publishing
- Posts to Twitter/LinkedIn via OAuth
- Updates post status and history
- Handles retries on failures

### 3. Process Queue (Every 2 hours)
```
GET https://your-app.vercel.app/api/cron/process-queue?secret=YOUR_SECRET
```
- Dequeues one feed from the generation queue
- Generates AI posts using GROQ
- Distributes posts to subscribers
- Schedules posts across the week

### 4. Refresh Tokens (Once daily at 00:30 UTC)
```
GET https://your-app.vercel.app/api/cron/refresh-tokens?secret=YOUR_SECRET
```
- Refreshes social media OAuth tokens before expiry
- Updates encrypted tokens in database
- Prevents authentication failures

### 5. Cleanup (Once daily at 03:00 UTC)
```
GET https://your-app.vercel.app/api/cron/cleanup?secret=YOUR_SECRET
```
- Removes old pending feeds (>24 hours)
- Cleans up failed jobs
- Optimizes database performance

## Manual Testing

You can manually trigger any cron job using curl:

```bash
# Feed Processing
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://your-app.vercel.app/api/cron/process-feeds

# Publish Posts
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://your-app.vercel.app/api/cron/publish-posts

# Process Queue
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://your-app.vercel.app/api/cron/process-queue

# Refresh Tokens
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://your-app.vercel.app/api/cron/refresh-tokens

# Cleanup
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://your-app.vercel.app/api/cron/cleanup
```

## Managing Cron Jobs

### Via API

You can manage cron jobs programmatically using the `/api/cron/manage` endpoint:

```bash
# List all jobs
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://your-app.vercel.app/api/cron/manage

# Delete a specific job
curl -X DELETE \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  "https://your-app.vercel.app/api/cron/manage?jobId=123"
```

### Via cron-job.org Console

Visit [console.cron-job.org](https://console.cron-job.org) to:
- View execution history for each job
- Enable/disable individual jobs
- Modify schedules without code changes
- Monitor performance and response times
- View saved responses and logs
- Adjust retry settings

## Rate Limits

### Free Tier (Current)
- **50 triggers per day** (our usage)
- **100 triggers per day** (limit)
- **50% utilization** - room for growth
- Max 1 job creation per second
- Max 5 requests per second for other operations

### If You Need More
**Sustaining Members (Paid)**
- 5,000 requests per day
- Higher rate limits
- Priority support

**Ways to Optimize Further:**
- Reduce publishing frequency (currently hourly)
- Increase feed processing interval (currently 2 hours)
- Combine low-frequency tasks if needed

## Troubleshooting

### Setup script fails with "Unauthorized"
- Verify your `CRON_JOB_ORG_API_KEY` is correct
- Check the API key hasn't expired
- Regenerate a new API key if needed at [console.cron-job.org/settings](https://console.cron-job.org/settings)

### Cron job not executing
- Check the job is **enabled** in the cron-job.org console
- Verify your `NEXT_PUBLIC_APP_URL` is correct and publicly accessible
- Check your application logs for authentication errors
- Ensure `CRON_SECRET` matches between your app and cron-job.org URLs
- Test the endpoint manually with curl

### "Rate limit exceeded" errors
- You've hit the 100 requests/day limit
- Check if you have duplicate jobs (delete extras)
- Wait until the next day (limits reset daily)
- Consider upgrading to sustaining membership
- Review which jobs are actually needed

### Authentication failures
- Verify `CRON_SECRET` is set correctly in Vercel environment variables
- Check the cron-job.org job URLs include `?secret=YOUR_SECRET`
- Review application logs for specific error messages
- Test manually: `curl -H "Authorization: Bearer YOUR_SECRET" YOUR_ENDPOINT`

### Jobs failing with timeouts
- Check function timeout limits on Vercel (default: 10s, max: 60s on Pro)
- Review logs to see which task is timing out
- Consider increasing `requestTimeout` in cron config (currently 60s)
- Optimize slow database queries or RSS fetches

### Some jobs succeed, others fail
- Check individual job execution history in cron-job.org console
- Review application logs for specific endpoints
- Verify all endpoints are deployed and accessible
- Test each endpoint manually

## Migration from Single Master Cron

If you previously used a single master cron job:

1. ✅ Code has been updated to support multiple jobs
2. ✅ API endpoints remain the same and still work individually
3. ✅ Authentication still uses `CRON_SECRET`
4. ⚠️ **Delete the old "Master Cron" job** from cron-job.org console
5. ⚠️ Run `npm run setup-cron` to create the new jobs
6. ⚠️ Verify all 5 jobs appear and are enabled

**Benefits of Migration:**
- More frequent publishing (1hr vs 24hr)
- More frequent feed processing (2hr vs 24hr)
- Better load distribution
- Easier to debug individual tasks
- No single point of failure

## API Endpoints Reference

All endpoints require authentication via `CRON_SECRET`:

| Endpoint | Method | Purpose | Frequency |
|----------|--------|---------|-----------|
| `/api/cron/process-feeds` | GET | Process RSS feeds | Every 2 hours |
| `/api/cron/publish-posts` | GET | Publish scheduled posts | Every hour |
| `/api/cron/process-queue` | GET | Generate AI posts | Every 2 hours |
| `/api/cron/refresh-tokens` | GET | Refresh OAuth tokens | Daily |
| `/api/cron/cleanup` | GET | Database cleanup | Daily |
| `/api/cron/manage` | GET/DELETE | Manage cron jobs | Manual |
| `/api/cron/master` | GET | Legacy (all tasks) | Deprecated |

## Additional Resources

- [cron-job.org Documentation](https://docs.cron-job.org/)
- [REST API Reference](https://docs.cron-job.org/rest-api.html)
- [Console Dashboard](https://console.cron-job.org)
- [Account Settings](https://console.cron-job.org/settings)
- [Job Execution History](https://console.cron-job.org/jobs)
