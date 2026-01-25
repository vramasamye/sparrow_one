# Sparrow - Local Development Setup Guide

This guide will help you set up Sparrow for local development and testing.

## Prerequisites

Before you begin, make sure you have:

- **Node.js 20+** - [Download](https://nodejs.org/)
- **Docker Desktop** - [Download](https://www.docker.com/products/docker-desktop/)
- **Git** - [Download](https://git-scm.com/)

## Quick Start (Automated)

Run the setup script:

```bash
./scripts/setup.sh
```

This will:
1. Start PostgreSQL and Redis via Docker
2. Create `.env.local` with generated secrets
3. Install dependencies
4. Set up the database schema
5. Seed the database with topics and RSS feeds

## Manual Setup

If you prefer to set up manually:

### Step 1: Start Docker Services

```bash
docker-compose up -d
```

This starts:
- PostgreSQL on port `5432`
- Redis on port `6380`

### Step 2: Create Environment File

```bash
cp .env.example .env.local
```

Generate and fill in the required secrets:

```bash
# Generate NEXTAUTH_SECRET
openssl rand -base64 32

# Generate ENCRYPTION_KEY
openssl rand -hex 32
```

### Step 3: Install Dependencies

```bash
npm install
```

### Step 4: Set Up Database

```bash
# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# Seed with topics and RSS feeds
npm run db:seed
```

### Step 5: Start Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Required API Keys

### Google OAuth (Required for login)

1. Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
2. Create a new OAuth 2.0 Client ID
3. Set application type to "Web application"
4. Add authorized redirect URI: `http://localhost:3000/api/auth/callback/google`
5. Copy Client ID and Client Secret to `.env.local`

### Groq AI (Required for content generation)

1. Go to [Groq Console](https://console.groq.com/keys)
2. Create a new API key
3. Copy to `GROQ_API_KEY` in `.env.local`

### Twitter OAuth (Optional - for posting)

1. Go to [Twitter Developer Portal](https://developer.twitter.com/en/portal/dashboard)
2. Create a new App with OAuth 2.0 User Authentication
3. Set callback URL: `http://localhost:3000/api/auth/callback/twitter`
4. Request scopes: `tweet.read`, `tweet.write`, `users.read`, `offline.access`
5. Copy Client ID and Client Secret to `.env.local`

### LinkedIn OAuth (Optional - for posting)

1. Go to [LinkedIn Developers](https://www.linkedin.com/developers/apps)
2. Create a new App
3. Add products: "Sign In with LinkedIn using OpenID Connect" and "Share on LinkedIn"
4. Set callback URL: `http://localhost:3000/api/auth/callback/linkedin`
5. Copy Client ID and Client Secret to `.env.local`

## Testing the Application

### 1. Sign In

1. Open [http://localhost:3000](http://localhost:3000)
2. Click "Get Started" or "Sign In"
3. Sign in with Google

### 2. Select Topics

1. Go to [http://localhost:3000/topics](http://localhost:3000/topics)
2. Click on topics you're interested in

### 3. Process Feeds (Admin)

Run the feed processor to fetch content:

```bash
curl http://localhost:3000/api/cron/process-feeds \
  -H "Authorization: Bearer dev-cron-secret"
```

Or use the test script:
```bash
./scripts/test-cron.sh
```

### 4. Approve Feeds (Admin)

1. Go to [http://localhost:3000/admin/feeds](http://localhost:3000/admin/feeds)
2. Review and approve pending feeds

### 5. Generate and Schedule Posts

1. Go to [http://localhost:3000/feed](http://localhost:3000/feed)
2. Click "Generate Post" on any article
3. Select platform (Twitter/LinkedIn)
4. Click "Generate" to create AI content
5. Click "Schedule Post" to queue it

### 6. View Scheduled Posts

Go to [http://localhost:3000/posts](http://localhost:3000/posts) to see all scheduled posts.

## Useful Commands

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm run lint             # Run linter

# Database
npm run db:studio        # Open Prisma Studio (database GUI)
npm run db:seed          # Seed database
npm run db:push          # Push schema changes
npm run db:migrate       # Run migrations

# Docker
docker-compose up -d     # Start containers
docker-compose down      # Stop containers
docker-compose logs -f   # View logs

# Scripts
./scripts/setup.sh       # Full setup
./scripts/reset-db.sh    # Reset database
./scripts/test-cron.sh   # Test cron jobs
```

## Troubleshooting

### Port already in use

```bash
# Check what's using the port
lsof -i :5432  # PostgreSQL
lsof -i :6380  # Redis
lsof -i :3000  # Next.js

# Kill the process
kill -9 <PID>
```

### Database connection failed

```bash
# Check if PostgreSQL is running
docker-compose ps

# Restart containers
docker-compose down && docker-compose up -d

# Check logs
docker-compose logs postgres
```

### Prisma errors

```bash
# Regenerate client
npx prisma generate

# Reset database
./scripts/reset-db.sh
```

### OAuth callback errors

Make sure your OAuth callback URLs are exactly:
- Google: `http://localhost:3000/api/auth/callback/google`
- Twitter: `http://localhost:3000/api/auth/callback/twitter`
- LinkedIn: `http://localhost:3000/api/auth/callback/linkedin`

## Project Structure

```
sparrow.one/
├── src/
│   ├── app/                 # Next.js App Router
│   │   ├── (protected)/     # Authenticated pages
│   │   │   ├── dashboard/   # Dashboard
│   │   │   ├── feed/        # Content feed
│   │   │   ├── posts/       # Scheduled posts
│   │   │   ├── topics/      # Topic selection
│   │   │   ├── settings/    # User settings
│   │   │   └── admin/       # Admin pages
│   │   ├── api/             # API routes
│   │   └── login/           # Login page
│   ├── components/          # React components
│   ├── lib/                 # Utilities
│   │   ├── ai.ts            # AI generation
│   │   ├── auth.ts          # NextAuth config
│   │   ├── cleanup.ts       # Database cleanup
│   │   ├── encryption.ts    # Token encryption
│   │   ├── feed-processor.ts# RSS processing
│   │   ├── prisma.ts        # Database client
│   │   ├── rss-parser.ts    # RSS parsing
│   │   ├── social-publisher.ts # Social posting
│   │   └── token-refresh.ts # OAuth refresh
│   └── hooks/               # React hooks
├── prisma/
│   ├── schema.prisma        # Database schema
│   └── seed.ts              # Seed data
├── scripts/                 # Setup scripts
├── docker-compose.yml       # Docker config
├── vercel.json              # Vercel cron config
└── .env.example             # Environment template
```

## Support

For issues or questions, please open an issue on GitHub.
