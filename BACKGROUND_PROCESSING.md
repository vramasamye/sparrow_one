# Background Feed Processing

## Overview

Sparrow's background feed processor is designed to be **resilient and respectful of rate limits**. It automatically:

1. ✅ **Only processes feeds for subscribed topics** - Reduces unnecessary API calls
2. ✅ **Waits for rate limits to reset** - No failed jobs due to rate limiting
3. ✅ **Retries with delays** - Automatically waits up to 10 minutes for API keys
4. ✅ **Batches processing** - Processes feeds in groups of 5 to avoid overwhelming APIs

## How It Works

### 1. Subscriber-Based Processing

The system **only fetches feeds for topics that have at least one user subscribed**:

```typescript
// In src/lib/feed-processor.ts
export async function processAllFeeds() {
  // Get topics with active subscribers
  const subscribedTopicIds = await prisma.userTopic.findMany({
    select: { topicId: true },
    distinct: ['topicId']
  })

  // Only fetch feeds for those topics
  const activeFeeds = await prisma.rssFeed.findMany({
    where: {
      isActive: true,
      topicId: { in: subscribedTopicIds }
    }
  })
}
```

**Example:**
- You have 10 topics total
- Only 2 topics have subscribers
- System only fetches 6 feeds (instead of 30)
- **Saves 80% of API calls!**

### 2. Rate Limit Retry Logic

When generating content, the system can **wait for rate limits** to reset:

```typescript
// Interactive mode (immediate fail if rate limited)
await generatePost({
  title: "...",
  url: "...",
  platform: "twitter",
  waitForRateLimit: false  // Default
})

// Background mode (wait up to 10 minutes)
await generatePost({
  title: "...",
  url: "...",
  platform: "twitter",
  waitForRateLimit: true  // For cron jobs
})
```

**Wait Logic:**
- Checks every 30 seconds for available key
- Maximum wait: 10 minutes
- Logs progress: `⏳ All keys rate limited. Waiting 30s... (attempt 5/20)`
- Returns null if timeout reached

### 3. Batch Processing

Feeds are processed in batches to avoid overwhelming the system:

```typescript
const batchSize = 5  // Process 5 feeds at a time

for (let i = 0; i < feeds.length; i += batchSize) {
  const batch = feeds.slice(i, i + batchSize)
  await Promise.all(batch.map(feed => processSingleFeed(feed)))
}
```

## Cron Job Setup

### cron-job.org (Recommended)

Sparrow uses [cron-job.org](https://cron-job.org) for scheduled tasks. See [CRON_SETUP.md](./CRON_SETUP.md) for setup instructions.

Quick setup:
1. Get API key from [cron-job.org Console](https://console.cron-job.org/settings)
2. Set `CRON_JOB_ORG_API_KEY` in your environment
3. Run `npm run setup-cron` after deployment

The master cron job runs daily at midnight UTC and handles all tasks sequentially.

### Alternative: External Cron Service

You can also use other services like:
- **EasyCron**
- **GitHub Actions**
- **Your own cron server**

Configuration:
```
URL: https://yourdomain.com/api/cron/master?secret=YOUR_CRON_SECRET
Method: GET
Schedule: Daily (or as needed)
```

### Server Crontab

```bash
# Edit crontab
crontab -e

# Add this line (runs every hour)
0 * * * * curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://yourdomain.com/api/cron/process-feeds
```

## Current Implementation

### Feed Processing Flow

```
1. Cron triggers → /api/cron/process-feeds
2. Verify CRON_SECRET
3. Get topics with subscribers
4. Fetch only those feeds
5. Parse RSS feeds (batched)
6. Store new items as PENDING
7. Return statistics
```

**Note:** The cron job **does NOT** generate social media posts. It only:
- Fetches RSS feeds
- Stores new items
- Updates feed metadata

Posts are generated when:
- Admin approves an item
- User schedules a post
- Auto-publishing is enabled (future feature)

## API Response

Successful response:
```json
{
  "success": true,
  "duration": "2341ms",
  "summary": {
    "feedsProcessed": 6,
    "successful": 5,
    "failed": 1,
    "newItems": 12,
    "duplicates": 38
  },
  "stats": {
    "pending": 46,
    "approved": 3,
    "rejected": 0,
    "published": 0,
    "activeFeeds": 6
  },
  "errors": [
    {
      "feed": "OpenAI Blog",
      "error": "Status code 403"
    }
  ]
}
```

## Rate Limit Optimization

### Current Strategy

With 3 GROQ API keys:
- **Capacity**: 120 req/min, 3,000 req/day
- **Only used for**: Post generation (not feed fetching)
- **Cron job**: Doesn't use GROQ at all!

### Feed Processing (No API Limits)

RSS feed fetching is **not rate limited** because:
- Uses standard HTTP requests
- No AI provider involved
- Only limited by feed server capacity

### When API Limits Matter

GROQ rate limits only apply when:
- Admin approves item → generates posts
- User schedules content
- Auto-publishing runs

## Monitoring

### Check Cron Job Status

```bash
# Call the endpoint manually
curl -H "Authorization: Bearer dev-cron-secret" \
  http://localhost:3000/api/cron/process-feeds
```

### View Feed Statistics

In the admin dashboard:
- `/admin/feeds` - View all pending items
- Filter by topic
- See fetch errors
- Approve/reject items

### Check Rate Limits

```bash
npm run test:feeds
```

Shows:
- Available GROQ keys
- Current usage per key
- Fetch statistics
- Generation success/failure

## Troubleshooting

### No Feeds Being Fetched

**Cause:** No users subscribed to any topics

**Solution:**
```typescript
// In Prisma Studio or code:
await prisma.userTopic.create({
  data: {
    userId: "user-id",
    topicId: "topic-id"
  }
})
```

### Feed Fetch Errors

Common errors:
- **403 Forbidden** - Feed blocks automated requests
- **404 Not Found** - Feed URL changed/removed
- **Timeout** - Feed server too slow

**Solution:**
- Update feed URL in database
- Disable problematic feeds
- Add user-agent headers (future improvement)

### All Items Showing as Duplicates

**Cause:** Feeds already fetched

**Solution:**
- This is normal! Duplicates are detected by content hash
- RSS feeds don't change every hour
- New items appear gradually

### Cron Not Running

**Vercel:**
- Check "Deployments" → "Cron"
- Verify `vercel.json` configuration
- Check deployment logs

**External Service:**
- Verify URL is correct
- Check Authorization header
- Review service logs

## Performance Tips

### 1. Reduce Fetch Frequency

For low-traffic topics:
```
Instead of: Every 1 hour
Use: Every 3-6 hours
```

### 2. Optimize Subscriptions

- Encourage users to unsubscribe from unused topics
- System automatically skips topics with no subscribers

### 3. Monitor Failed Feeds

- Disable feeds with consistent errors
- Update URLs for moved feeds
- Remove dead feeds

### 4. Batch Size Tuning

```typescript
// For slower servers
const batchSize = 3

// For faster servers
const batchSize = 10
```

## Future Enhancements

- [ ] Smart scheduling (fetch popular feeds more often)
- [ ] User-agent rotation for blocked feeds
- [ ] Webhook support for real-time feeds
- [ ] Auto-disable repeatedly failing feeds
- [ ] Feed health monitoring dashboard
- [ ] Custom fetch intervals per feed
- [ ] Parallel processing with worker threads

## Security

### Cron Secret

Always use a strong secret in production:

```bash
# Generate a secure secret
openssl rand -base64 32

# Add to .env.local
CRON_SECRET="your-secure-random-secret"
```

### Rate Limit Protection

The cron job has built-in protection:
- No infinite loops
- Timeouts on feed fetching
- Error handling per feed
- Batch processing limits

### DoS Prevention

To prevent overload:
- Maximum 5 feeds processed simultaneously
- Feed fetch timeout: 30 seconds
- Total cron timeout: Vercel 10s (Hobby), 60s (Pro)

## Summary

✅ **Efficient**: Only processes subscribed topics
✅ **Resilient**: Waits for rate limits to reset
✅ **Reliable**: Handles errors gracefully
✅ **Fast**: Batch processing for speed
✅ **Secure**: CRON_SECRET authentication
✅ **Monitored**: Detailed statistics and logging

The background processor is designed to run **slowly but surely**, respecting all rate limits while ensuring no feed items are missed.
