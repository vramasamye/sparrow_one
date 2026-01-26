# Cron Job Setup with cron-job.org

This application uses [cron-job.org](https://cron-job.org) for scheduled task execution instead of Vercel's built-in cron jobs.

## Why cron-job.org?

- **Free tier**: 100 API requests per day (sufficient for daily cron jobs)
- **Reliable**: Dedicated cron service with monitoring
- **Flexible**: Easy to manage and monitor via web console
- **No Vercel limitations**: Works with any hosting provider

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

### 3. Run the Setup Script

After deploying your application, run:

```bash
npm run setup-cron
```

This script will:
- Validate your environment variables
- Create the master cron job on cron-job.org
- Configure it to run daily at midnight UTC
- Set up authentication using your CRON_SECRET

### 4. Verify Setup

1. Visit [cron-job.org Console](https://console.cron-job.org)
2. Check that your "Sparrow.one Master Cron" job is listed
3. Verify it's enabled and scheduled correctly
4. Monitor the first execution to ensure it works

## How It Works

1. **cron-job.org** sends a GET request to `https://your-app.vercel.app/api/cron/master` daily at midnight UTC
2. The request includes your `CRON_SECRET` as a Bearer token for authentication
3. The master cron job executes all tasks sequentially:
   - Refresh expiring tokens
   - Process RSS feeds
   - Process one job from the queue
   - Publish scheduled posts
   - Run cleanup tasks

## Managing Cron Jobs

### Via API

You can manage cron jobs programmatically using the `/api/cron/manage` endpoint:

```bash
# List all jobs
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://your-app.vercel.app/api/cron/manage

# Delete a job
curl -X DELETE \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  "https://your-app.vercel.app/api/cron/manage?jobId=123"
```

### Via cron-job.org Console

Visit [console.cron-job.org](https://console.cron-job.org) to:
- View execution history
- Enable/disable jobs
- Modify schedules
- Monitor performance

## Rate Limits

### Free Tier
- **100 requests per day** total
- Max 1 job creation per second
- Max 5 requests per second for other operations

### Sustaining Members (Paid)
- 5,000 requests per day
- Higher rate limits

## Troubleshooting

### Setup script fails with "Unauthorized"
- Verify your `CRON_JOB_ORG_API_KEY` is correct
- Check the API key hasn't expired
- Regenerate a new API key if needed

### Cron job not executing
- Check the job is enabled in the cron-job.org console
- Verify your `NEXT_PUBLIC_APP_URL` is correct and accessible
- Check your application logs for authentication errors
- Ensure `CRON_SECRET` matches between your app and cron-job.org

### "Rate limit exceeded" errors
- You've hit the 100 requests/day limit
- Wait until the next day or upgrade to a sustaining membership
- Consider reducing the number of API calls

### Authentication failures
- Verify `CRON_SECRET` is set correctly
- Check the cron-job.org job configuration includes the Bearer token
- Review application logs for specific error messages

## Migration from Vercel Cron

If you previously used Vercel's built-in cron jobs:

1. ✅ `vercel.json` has been updated (crons removed)
2. ✅ API endpoints remain the same (`/api/cron/master`)
3. ✅ Authentication still uses `CRON_SECRET`
4. ⚠️ Run `npm run setup-cron` after your next deployment
5. ⚠️ Verify first execution in cron-job.org console

## Additional Resources

- [cron-job.org Documentation](https://docs.cron-job.org/)
- [REST API Reference](https://docs.cron-job.org/rest-api.html)
- [Console](https://console.cron-job.org)
