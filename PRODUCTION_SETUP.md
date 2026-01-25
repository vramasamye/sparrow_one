# Production Deployment Guide - Sparrow

This guide outlines the steps to deploy Sparrow to a production environment (Vercel + Managed Database + Managed Redis).

## 1. Prerequisites

- **Vercel Account**: For hosting the Next.js application.
- **PostgreSQL Database**: Recommended: [Neon](https://neon.tech), [Supabase](https://supabase.com), or [AWS RDS](https://aws.amazon.com/rds/).
- **Redis Instance**: Recommended: [Upstash](https://upstash.com) (Serverless Redis).
- **Domain Name**: With SSL (Vercel provides this by default).

## 2. Environment Variables

Set these in your Vercel Project Settings:

### Core
- `DATABASE_URL`: Your production PostgreSQL connection string (use `?pgbouncer=true` if using a pooler).
- `REDIS_URL`: Your production Redis connection string (e.g., `redis://default:password@host:port`).
- `NEXTAUTH_SECRET`: Generate with `openssl rand -base64 32`.
- `NEXTAUTH_URL`: Your production domain (e.g., `https://sparrow.yourdomain.com`).
- `ENCRYPTION_KEY`: A 32-character hex string for encrypting tokens. Generate with `openssl rand -hex 32`.
- `CRON_SECRET`: A secure random string to authorize cron jobs. Generate with `openssl rand -base64 32`.

### AI Providers
- `GROQ_API_KEY`: Your production Groq API key.
- `GROQ_API_KEYS`: (Optional) Comma-separated list of multiple keys for rotation.

### Social Platform OAuth (Production Credentials)
- `GOOGLE_CLIENT_ID`: Production Google OAuth ID.
- `GOOGLE_CLIENT_SECRET`: Production Google OAuth Secret.
- `TWITTER_CLIENT_ID`: Production Twitter App Client ID.
- `TWITTER_CLIENT_SECRET`: Production Twitter App Client Secret.
- `LINKEDIN_CLIENT_ID`: Production LinkedIn App Client ID.
- `LINKEDIN_CLIENT_SECRET`: Production LinkedIn App Client Secret.

## 3. Database Strategy (Migrations)

Sparrow uses Prisma. In production, you must use Migrations instead of `db push`.

1. **Initialize Migrations** (locally before deployment):
   ```bash
   npx prisma migrate dev --name init
   ```
2. **Commit the `prisma/migrations` folder** to your repository.
3. **Automate Deployments**: The build script in `package.json` should include `prisma migrate deploy`.

## 4. Vercel Configuration

The `vercel.json` is already configured with the following cron jobs:
- `/api/cron/process-feeds`: Every 2 hours (Fetches RSS content).
- `/api/cron/process-queue`: Every 10 minutes (Generates AI content for approved feeds).
- `/api/cron/publish-posts`: Every 5 minutes (Publishes scheduled posts).
- `/api/cron/refresh-tokens`: Every 6 hours (Refreshes social OAuth tokens).
- `/api/cron/cleanup`: Daily (Removes old logs and temporary data).

## 5. Deployment Steps

1. **Push your code** to GitHub/GitLab/Bitbucket.
2. **Connect to Vercel**: Import the project.
3. **Configure Environment Variables** in the Vercel dashboard.
4. **Deploy**: Vercel will run the build command and set up the edge functions.
5. **Verify**:
   - Check the `/api/health` endpoint.
   - Run a manual cron trigger using `curl -H "Authorization: Bearer YOUR_CRON_SECRET" https://yourdomain.com/api/cron/process-feeds`.

## 6. Monitoring & Maintenance

- **Vercel Logs**: Monitor for runtime errors.
- **Sentry (Optional)**: Highly recommended for error tracking. Add `NEXT_PUBLIC_SENTRY_DSN`.
- **Admin Dashboard**: Use the `/admin` path in the app to monitor feed health and post status.
- **Database Backups**: Ensure your managed DB provider has automated backups enabled.

## 7. Security Hardening

- Ensure `CRON_SECRET` is strong and unique.
- Use a dedicated email for OAuth app ownership.
- Regularly rotate `ENCRYPTION_KEY` (note: this will invalidate existing social account tokens).
- Keep dependencies updated with `npm update`.
