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
- `NEXT_PUBLIC_APP_URL`: Your production domain (e.g., `https://sparrow.yourdomain.com`).
- `ENCRYPTION_KEY`: A 32-character hex string for encrypting tokens. Generate with `openssl rand -hex 32`.
- `CRON_SECRET`: A secure random string to authorize cron jobs. Generate with `openssl rand -base64 32`.
- `CRON_JOB_ORG_API_KEY`: Get from [cron-job.org Console](https://console.cron-job.org/settings) - API section.

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

## 4. Cron Job Configuration

Sparrow uses [cron-job.org](https://cron-job.org) for scheduled tasks instead of Vercel's built-in cron:

**Benefits:**
- Works with Vercel Hobby plan (no cron limitations)
- 100 free cron executions per day
- Reliable monitoring and execution history
- Easy to manage via web console

**Setup:**
1. Create a free account at [cron-job.org](https://cron-job.org)
2. Generate an API key from [Console Settings](https://console.cron-job.org/settings)
3. Add `CRON_JOB_ORG_API_KEY` to your Vercel environment variables
4. After deployment, run: `npm run setup-cron` to configure the cron job

The master cron job runs daily at midnight UTC and executes:
- Token refresh
- RSS feed processing
- Queue processing
- Post publishing
- Cleanup tasks

See [CRON_SETUP.md](./CRON_SETUP.md) for detailed instructions.

## 5. Deployment Steps

1. **Push your code** to GitHub/GitLab/Bitbucket.
2. **Connect to Vercel**: Import the project.
3. **Configure Environment Variables** in the Vercel dashboard (including `CRON_JOB_ORG_API_KEY`).
4. **Deploy**: Vercel will run the build command and set up the edge functions.
5. **Setup Cron Jobs**: After deployment, run `npm run setup-cron` locally to configure cron-job.org.
6. **Verify**:
   - Check the `/api/health` endpoint.
   - Visit [cron-job.org Console](https://console.cron-job.org) to verify the job is created.
   - Run a manual cron trigger: `curl "https://yourdomain.com/api/cron/master?secret=YOUR_CRON_SECRET"`.

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
