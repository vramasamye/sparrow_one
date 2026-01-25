# GROQ Multi-Key Setup Guide

## Quick Start

### 1. Configure Multiple GROQ API Keys

Add this to your `.env.local`:

```bash
# Multiple GROQ keys (comma-separated, no spaces around commas)
GROQ_API_KEYS="gsk_key1_here,gsk_key2_here,gsk_key3_here"

# Redis (required for rate limiting)
REDIS_URL="redis://localhost:6380"

# OpenRouter (fallback)
OPENROUTER_API_KEY="sk-or-your-key"
```

### 2. Start Redis

```bash
docker-compose up -d redis
```

Or if using Upstash/remote Redis, just set `REDIS_URL`.

### 3. Test the Setup

```bash
# Run comprehensive test
npm run test:feeds
```

This will:
- ✅ Show rate limit status for all 3 keys
- ✅ Fetch RSS feeds
- ✅ Simulate admin approval
- ✅ Generate posts using GROQ
- ✅ Display real-time rate limit consumption

## Rate Limits Per Key

Each GROQ API key has these **independent** limits:

### moonshotai/kimi-k2-instruct
```
40 requests/min
1,000 requests/day
9,000 tokens/min
250,000 tokens/day
```

### moonshotai/kimi-k2-instruct-0905
```
40 requests/min
1,000 requests/day
9,000 tokens/min
250,000 tokens/day
```

### meta-llama/llama-guard-4-12b
```
20 requests/min
13,000 requests/day
15,000 tokens/min
500,000 tokens/day
```

## Total Capacity with 3 Keys

### For kimi-k2-instruct (default model):
- **120 requests/min** (40 × 3)
- **3,000 requests/day** (1,000 × 3)
- **27,000 tokens/min** (9,000 × 3)
- **750,000 tokens/day** (250,000 × 3)

## How It Works

1. **Request comes in** → System checks all 3 keys
2. **First available key** → Selected for the request
3. **After request** → Usage recorded in Redis
4. **Automatic rotation** → Next request uses next available key
5. **All keys exhausted?** → Falls back to OpenRouter

## ENV Configuration Examples

### Single Key (Basic)
```bash
GROQ_API_KEY="gsk_single_key_here"
```

### Multiple Keys (Recommended)
```bash
GROQ_API_KEYS="gsk_key1,gsk_key2,gsk_key3"
```

### With All Services
```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/sparrow"
REDIS_URL="redis://localhost:6380"
GROQ_API_KEYS="gsk_key1,gsk_key2,gsk_key3"
OPENROUTER_API_KEY="sk-or-fallback-key"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret"
GOOGLE_CLIENT_ID="your-google-id"
GOOGLE_CLIENT_SECRET="your-google-secret"
ENCRYPTION_KEY="your-32-char-hex-key"
CRON_SECRET="your-cron-secret"
```

## Testing Commands

```bash
# Full feed processing test
npm run test:feeds

# User subscription flow test
npm run test:user-flow

# Scheduled posting test
npm run test:schedule
```

## Monitoring Rate Limits

### Check Redis
```bash
redis-cli -h localhost -p 6380

# View all rate limit keys
KEYS ratelimit:*

# Get specific usage
GET ratelimit:{keyId}:moonshotai/kimi-k2-instruct:rpm:{window}
```

### Programmatically
```typescript
import { checkAvailability, getAvailableKey } from "@/lib/rate-limiter"

// Check if system is available
const available = await checkAvailability("moonshotai/kimi-k2-instruct")

// Get an available key
const key = await getAvailableKey("moonshotai/kimi-k2-instruct")
if (!key) {
  console.log("All keys rate limited - using fallback")
}
```

## Troubleshooting

### "Rate limit exceeded for all available Groq API keys"

**Solutions:**
1. Wait 1 minute for RPM reset
2. Wait 24 hours for RPD reset
3. Add more keys to `GROQ_API_KEYS`
4. System will auto-fallback to OpenRouter

### Redis Connection Error

**Solutions:**
1. Check Redis is running: `redis-cli -h localhost -p 6380 ping`
2. Verify `REDIS_URL` in `.env.local`
3. Start Redis: `docker-compose up -d redis`

### Keys Not Being Used

**Solutions:**
1. Check format: `GROQ_API_KEYS="key1,key2,key3"` (no spaces!)
2. Verify keys are valid at https://console.groq.com/keys
3. Check `.env.local` is in root directory
4. Restart dev server: `npm run dev`

## Files Changed/Added

### Modified
- ✅ `src/lib/rate-limiter.ts` - Updated with exact limits
- ✅ `.env.example` - Added multi-key documentation
- ✅ `package.json` - Added test scripts

### Created
- ✅ `scripts/test-feed-admin-approval.ts` - Comprehensive test script
- ✅ `RATE_LIMITING.md` - Detailed documentation
- ✅ `GROQ_SETUP_GUIDE.md` - This file
- ✅ `.env.sample.multiple-keys` - Sample configuration

## Production Deployment

### Required ENV Variables
```bash
DATABASE_URL="your-production-postgres-url"
REDIS_URL="your-production-redis-url"
GROQ_API_KEYS="key1,key2,key3"
OPENROUTER_API_KEY="your-fallback-key"
NEXTAUTH_URL="https://yourdomain.com"
NEXTAUTH_SECRET="secure-random-secret"
ENCRYPTION_KEY="secure-random-32-char-hex"
CRON_SECRET="secure-random-cron-secret"
GOOGLE_CLIENT_ID="your-google-oauth-id"
GOOGLE_CLIENT_SECRET="your-google-oauth-secret"
```

### Cron Job Setup

For scheduled feed processing, set up a cron job to hit:
```
GET https://yourdomain.com/api/cron/process-feeds
Authorization: Bearer {CRON_SECRET}
```

Example (every hour):
```cron
0 * * * * curl -H "Authorization: Bearer ${CRON_SECRET}" https://yourdomain.com/api/cron/process-feeds
```

## Security Notes

1. **Never commit** `.env.local` to git
2. **Rotate keys** regularly
3. **Use secure secrets** for production
4. **Enable Redis auth** in production
5. **Monitor usage** for anomalies

## Support

For issues or questions:
1. Check `RATE_LIMITING.md` for detailed info
2. Run `npm run test:feeds` to diagnose
3. Check Redis connection and logs
4. Verify all ENV variables are set correctly
