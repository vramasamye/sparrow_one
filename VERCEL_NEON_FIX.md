# Fixing Neon Database Migration Timeout on Vercel

## Problem
Migrations timeout during Vercel build with error:
```
P1002: Timed out trying to acquire a postgres advisory lock
```

## Root Cause
Neon's **connection pooler** (used by `POSTGRES_PRISMA_URL`) doesn't support the advisory locks that Prisma migrations require. Migrations need a **direct connection**.

## Solution

### Option 1: Update DATABASE_URL in Vercel (Recommended)

If using Vercel Postgres integration, you have these variables available:
- `POSTGRES_PRISMA_URL` - Pooled (for app queries) ❌ Can't use for migrations
- `POSTGRES_URL_NON_POOLING` - Direct (for migrations) ✅ Use this

**Fix:**
1. Go to Vercel → Settings → Environment Variables
2. Update `DATABASE_URL`:
   ```
   DATABASE_URL=${POSTGRES_URL_NON_POOLING}
   ```
3. Save and redeploy

**Note:** This uses the direct connection for both app and migrations. It works but connection pooling is better for serverless. See Option 2 for optimal setup.

### Option 2: Run Migrations Separately (Current Setup)

The build script now skips migrations to avoid timeouts. Run migrations manually after first deployment:

#### Step 1: Get Direct Connection URL
From Neon dashboard or Vercel Postgres integration, get the **direct** (non-pooled) URL.

It looks like:
```
postgresql://user:pass@ep-xxx.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require
```

(Without `-pooler` in the hostname)

#### Step 2: Run Migrations Locally

Set the direct URL temporarily and run migrations:

```bash
# Export the direct connection URL
export DATABASE_URL="postgresql://user:pass@ep-xxx.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require"

# Run migrations
npx prisma migrate deploy
```

Or as a one-liner:
```bash
DATABASE_URL="your-direct-url" npx prisma migrate deploy
```

#### Step 3: Verify Migrations

Check in your Neon console or via psql that tables were created:
```bash
DATABASE_URL="your-direct-url" npx prisma db pull
```

### Option 3: Use Prisma's directUrl (Advanced)

For the optimal setup that uses pooling for app queries and direct connection for migrations:

1. **Update schema.prisma:**
   ```prisma
   datasource db {
     provider  = "postgresql"
     url       = env("DATABASE_URL")
     directUrl = env("DIRECT_DATABASE_URL")
   }
   ```

2. **Set both URLs in Vercel:**
   ```bash
   DATABASE_URL=${POSTGRES_PRISMA_URL}           # Pooled for app
   DIRECT_DATABASE_URL=${POSTGRES_URL_NON_POOLING}  # Direct for migrations
   ```

3. **Update build script in package.json:**
   ```json
   "build": "prisma migrate deploy && prisma generate && next build"
   ```

4. **Redeploy**

This gives you:
- ✅ Connection pooling for app queries (better performance)
- ✅ Direct connection for migrations (no timeouts)

## Current Status

**Migrations are currently skipped during build** to avoid timeouts. The database schema should already be created from the initial seed.

If you need to run migrations:
1. Use Option 1 or 2 above
2. Or implement Option 3 for the best long-term solution

## Verification

After running migrations, verify everything works:

```bash
# Check your app loads
curl https://sparrow-one-gold.vercel.app/

# Check database connection
curl https://sparrow-one-gold.vercel.app/api/health

# Check admin access
curl https://sparrow-one-gold.vercel.app/api/admin/check-role
```
