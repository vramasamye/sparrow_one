# Getting Started with Sparrow

Sparrow is a natural social media automation platform that uses AI to curate, generate, and publish content from RSS feeds to Twitter and LinkedIn.

## Features

- 🤖 **AI-Powered Content Generation** - Automatically generates engaging posts
- 📡 **RSS Feed Processing** - Monitors multiple RSS feeds
- 🎯 **AI Content Scoring** - Uses Llama Guard for quality filtering
- ⏰ **Natural Scheduling** - Posts at optimal times in your timezone
- 🔄 **Full Automation** - Complete hands-off workflow
- 🌍 **Timezone Support** - Personalized posting schedules
- 📊 **Multiple Platforms** - Twitter and LinkedIn support

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL database (or Neon serverless)
- Redis instance (or Upstash)
- Twitter API credentials (OAuth 2.0)
- LinkedIn API credentials (OAuth 2.0)
- Groq API key (for AI generation)
- Anthropic API key (optional, for Claude AI)
- cron-job.org account (for automation)

## Quick Setup

### 1. Clone and Install

```bash
git clone https://github.com/yourusername/sparrow.git
cd sparrow
npm install
```

### 2. Environment Variables

Copy `.env.example` to `.env.local` and fill in:

```env
# Database
DATABASE_URL="postgresql://..."
DIRECT_URL="postgresql://..."  # For Neon

# Redis
REDIS_URL="redis://..."

# NextAuth
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"

# Social Auth (for OAuth login)
TWITTER_CLIENT_ID="your_twitter_client_id"
TWITTER_CLIENT_SECRET="your_twitter_client_secret"
LINKEDIN_CLIENT_ID="your_linkedin_client_id"
LINKEDIN_CLIENT_SECRET="your_linkedin_client_secret"

# Social Publishing (for posting)
TWITTER_OAUTH_CLIENT_ID="your_app_client_id"
TWITTER_OAUTH_CLIENT_SECRET="your_app_client_secret"
LINKEDIN_CLIENT_ID_PUBLISHING="your_linkedin_app_id"
LINKEDIN_CLIENT_SECRET_PUBLISHING="your_linkedin_app_secret"

# AI Services
GROQ_API_KEY="your_groq_api_key"
ANTHROPIC_API_KEY="your_anthropic_key"  # Optional

# Encryption
ENCRYPTION_KEY="generate-with-openssl-rand-hex-32"

# Cron
CRON_SECRET="generate-random-string"
CRON_JOB_ORG_API_KEY="your_cronjob_org_key"
NEXT_PUBLIC_APP_URL="https://your-app.vercel.app"
```

### 3. Database Setup

```bash
# Run migrations
npx prisma migrate deploy

# Generate Prisma client
npx prisma generate

# Seed database with topics (optional)
npm run db:seed
```

### 4. Import RSS Feeds

```bash
# Import topics and RSS feeds
npm run import-topics
```

### 5. Setup Cron Jobs

```bash
# Choose your strategy (balanced recommended)
npm run setup-cron:balanced
```

### 6. Run Development Server

```bash
npm run dev
```

Visit http://localhost:3000

## First Steps

### 1. Create an Account
- Sign up with Twitter or LinkedIn
- Complete profile setup

### 2. Connect Social Accounts
- Go to Settings → Social Accounts
- Connect your Twitter and/or LinkedIn accounts
- Grant necessary permissions

### 3. Subscribe to Topics
- Browse available topics
- Subscribe to topics you're interested in
- Posts will be generated from these topics

### 4. Configure Schedule (Optional)
- Go to Settings → Schedule (if UI is implemented)
- Set your timezone
- Choose posting times
- Set quiet hours and active days

### 5. Wait for Automation
- RSS feeds are fetched automatically
- AI generates posts from approved feeds
- Posts are scheduled based on your preferences
- Publishing happens automatically

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     Sparrow Automation                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. RSS Feeds → Fetch every 2-3 hours                       │
│  2. AI Scoring → Llama Guard scores content quality         │
│  3. Admin Review → Manual approval of pending items         │
│  4. Queue → Approved feeds added to generation queue        │
│  5. AI Generation → Groq generates Twitter + LinkedIn posts │
│  6. Distribution → Posts scheduled per user preferences     │
│  7. Publishing → Posts published every minute               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

## Cron Jobs

All automation is handled by cron-job.org:

| Job | Frequency | Purpose |
|-----|-----------|---------|
| **Score Feeds** | Every 30 min | AI scoring with Llama Guard |
| **Process Queue** | Every 20 min | Generate AI posts |
| **Publish Posts** | Every 1 min | Publish scheduled posts |
| **Process Feeds** | Every 2 hrs | Fetch new RSS items |
| **Refresh Tokens** | Daily | Refresh OAuth tokens |
| **Cleanup** | Daily | Database maintenance |

See [CRON_SETUP.md](./CRON_SETUP.md) for details.

## Next Steps

- Read [CRON_SETUP.md](./CRON_SETUP.md) for automation setup
- Read [PRODUCTION_SETUP.md](../PRODUCTION_SETUP.md) for deployment
- Read [GROQ_SETUP_GUIDE.md](./GROQ_SETUP_GUIDE.md) for AI configuration
- Read [SCORING_SETUP_GUIDE.md](./SCORING_SETUP_GUIDE.md) for content scoring

## Troubleshooting

See [TROUBLESHOOT_CRON.md](./TROUBLESHOOT_CRON.md) for common issues.

## Support

- GitHub Issues: https://github.com/yourusername/sparrow/issues
- Documentation: `/docs`
