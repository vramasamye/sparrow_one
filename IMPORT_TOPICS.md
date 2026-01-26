# Import Topics and RSS Feeds

This guide explains how to bulk import topics and RSS feeds into your database.

## What Gets Imported

The import includes **11 topics** with **67 RSS feeds** across multiple categories:

1. **AI & Machine Learning** (7 feeds) - VentureBeat AI, MIT Tech Review, OpenAI, etc.
2. **Business & Entrepreneurship** (6 feeds) - HBR, Forbes, Entrepreneur, etc.
3. **Technology & Startups** (7 feeds) - TechCrunch, Wired, Hacker News, etc.
4. **Finance & Investing** (6 feeds) - Bloomberg, WSJ, MarketWatch, etc.
5. **Marketing & Social Media** (6 feeds) - HubSpot, Moz, Social Media Examiner, etc.
6. **Health & Wellness** (6 feeds) - Harvard Health, MyFitnessPal, etc.
7. **Sustainability & Climate Tech** (4 feeds) - TechCrunch Climate, MIT Tech Review, etc.
8. **Cybersecurity** (4 feeds) - TechCrunch Security, Forbes, Ars Technica, etc.
9. **Gaming & Entertainment** (3 feeds) - Forbes Gaming, BBC Entertainment, etc.
10. **Leadership & Productivity** (5 feeds) - HBR Leadership, Forbes, Zen Habits, etc.
11. **SaaS & Enterprise Tech** (4 feeds) - TechCrunch Enterprise, VentureBeat, etc.

All feeds are pre-verified and active as of January 2026.

## Import Methods

You have two options to import the data:

### Option 1: API Endpoint (Production - Recommended)

Use this method to import directly to your production database:

```bash
curl -X POST https://sparrow-one-gold.vercel.app/api/admin/import-topics \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Replace `YOUR_CRON_SECRET` with your actual cron secret.**

**Response Example:**
```json
{
  "success": true,
  "message": "Import completed",
  "summary": {
    "topics": "11 created, 0 skipped",
    "feeds": "67 created, 0 skipped"
  },
  "results": {
    "topics": { "created": 11, "skipped": 0, "errors": [] },
    "feeds": { "created": 67, "skipped": 0, "errors": [] }
  }
}
```

### Option 2: Local Script

Use this method to import to your local or production database via script:

#### For Local Database:
```bash
npm run import-topics
```

#### For Production Database:
```bash
# Set your production database URL first
export DATABASE_URL="your-production-postgres-url"

# Then run the import
npm run import-topics
```

Or as a one-liner:
```bash
DATABASE_URL="your-production-url" npm run import-topics
```

## How It Works

The import process:

1. **Reads** `data/topics-feeds.json`
2. **Creates topics** if they don't exist (checks by slug)
3. **Creates RSS feeds** if they don't exist (checks by URL)
4. **Skips duplicates** - Won't create topics/feeds that already exist
5. **Reports results** - Shows what was created, skipped, and any errors

### Safe to Run Multiple Times

The import is **idempotent** - running it multiple times won't create duplicates:
- Existing topics are skipped (matched by slug)
- Existing RSS feeds are skipped (matched by URL)
- Only new items are created

## After Import

Once imported, you can:

### 1. View Topics in Admin Panel
```
https://sparrow-one-gold.vercel.app/admin/topics
```

You'll see all 11 topics with their RSS feeds listed.

### 2. Test Feed Fetching

Trigger a manual feed fetch to pull in articles:

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" \
  https://sparrow-one-gold.vercel.app/api/cron/process-feeds
```

This will fetch articles from all active RSS feeds.

### 3. Manage Feeds

In the admin panel (`/admin/topics`), you can:
- Toggle feeds active/inactive
- Add more feeds to any topic
- Delete feeds you don't want
- Click RSS URLs to preview feed content

### 4. Approve Articles

Visit `/admin/feeds` to:
- Review fetched articles
- Approve articles for AI post generation
- See pending, approved, and rejected articles

## Customizing the Data

To modify what gets imported:

1. **Edit** `data/topics-feeds.json`
2. **Add/Remove** topics or feeds as needed
3. **Run import** again (won't create duplicates)

### JSON Structure:
```json
{
  "topics": [
    {
      "topic_name": "Your Topic Name",
      "description": "Topic description",
      "feeds": [
        {
          "source": "Feed Name",
          "url": "https://example.com/feed.xml"
        }
      ]
    }
  ]
}
```

## Troubleshooting

### Error: "Unauthorized"
- Check your `CRON_SECRET` is correct
- Ensure you're using `Bearer YOUR_CRON_SECRET` format

### Error: "File not found"
- Make sure `data/topics-feeds.json` exists
- Check you're running from project root directory

### Some Feeds Failed to Create
- Check the error message in the response
- Verify the RSS feed URL is valid and accessible
- Some feeds may have CORS restrictions or be temporarily down

### Import Hangs or Times Out
- Some RSS feeds may be slow to verify
- Try importing with fewer feeds first
- Check your internet connection

## Verification

After import, verify everything worked:

```bash
# Check topics count
curl https://sparrow-one-gold.vercel.app/api/admin/topics

# Or via admin panel
https://sparrow-one-gold.vercel.app/admin/topics
```

You should see:
- 11 topics created
- 67 RSS feeds across all topics
- All feeds marked as active

## Next Steps

After importing:

1. **Fetch Articles** - Run the feed processor cron job
2. **Review & Approve** - Go to `/admin/feeds` to approve articles
3. **Generate Posts** - AI will create posts for approved articles
4. **Schedule & Publish** - Posts get automatically scheduled and published

The complete workflow is now set up! 🎉
