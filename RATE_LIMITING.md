# GROQ Rate Limiting Implementation

## Overview

Sparrow uses a **strict Redis-based rate limiting system** to manage GROQ API usage across multiple API keys. Each key has independent rate limits, and the system automatically rotates between keys to maximize throughput while respecting GROQ's hard limits.

## GROQ Model Rate Limits

Each GROQ API key has the following **hard limits** per model:

### 1. moonshotai/kimi-k2-instruct
- **40 requests per minute**
- **1,000 requests per day**
- **9,000 tokens per minute**
- **250,000 tokens per day**

### 2. moonshotai/kimi-k2-instruct-0905
- **40 requests per minute**
- **1,000 requests per day**
- **9,000 tokens per minute**
- **250,000 tokens per day**

### 3. meta-llama/llama-guard-4-12b
- **20 requests per minute**
- **13,000 requests per day**
- **15,000 tokens per minute**
- **500,000 tokens per day**

## Multi-Key Configuration

### Environment Variables

You can configure multiple GROQ API keys in two ways:

#### Option 1: Single Key (Basic)
```bash
GROQ_API_KEY="gsk_your_single_key_here"
```

#### Option 2: Multiple Keys (Recommended for Production)
```bash
GROQ_API_KEYS="gsk_key1_here,gsk_key2_here,gsk_key3_here"
```

**Important:** If `GROQ_API_KEYS` is set, it takes precedence over `GROQ_API_KEY`.

### Capacity Multiplication

With 3 API keys, you get **3x the capacity**:

**For moonshotai/kimi-k2-instruct:**
- 120 requests per minute (40 × 3)
- 3,000 requests per day (1,000 × 3)
- 27,000 tokens per minute (9,000 × 3)
- 750,000 tokens per day (250,000 × 3)

**For meta-llama/llama-guard-4-12b:**
- 60 requests per minute (20 × 3)
- 39,000 requests per day (13,000 × 3)
- 45,000 tokens per minute (15,000 × 3)
- 1,500,000 tokens per day (500,000 × 3)

## How It Works

### 1. Key Selection
When making an API request:
1. System checks all available keys
2. For each key, verifies:
   - Current requests < RPM limit
   - Daily requests < RPD limit
   - Current tokens < TPM limit
   - Daily tokens < TPD limit
3. Returns the first available key
4. If all keys are exhausted, returns `null`

### 2. Usage Tracking
After each request:
1. Records request count (increments by 1)
2. Records token usage (increments by actual tokens used)
3. Updates both minute and day windows in Redis
4. Sets appropriate TTL for cleanup

### 3. Redis Keys Structure
```
ratelimit:{keyId}:{model}:rpm:{minuteWindow}    # Request count per minute
ratelimit:{keyId}:{model}:rpd:{dayWindow}       # Request count per day
tokenlimit:{keyId}:{model}:tpm:{minuteWindow}   # Token count per minute
tokenlimit:{keyId}:{model}:tpd:{dayWindow}      # Token count per day
```

### 4. Time Windows
- **Minute window:** `Math.floor(Date.now() / 60000)` - Resets every minute
- **Day window:** `Math.floor(Date.now() / 86400000)` - Resets every 24 hours

### 5. Key ID Generation
Keys are hashed for Redis storage:
```typescript
const keyId = Buffer.from(apiKey).toString('base64').substring(0, 10)
```

## Implementation Files

### Core Files
- `src/lib/rate-limiter.ts` - Main rate limiting logic
- `src/lib/redis.ts` - Redis connection
- `src/lib/ai.ts` - AI generation with rate limiting

### Key Functions

#### `getAvailableKey(model: string): Promise<string | null>`
Returns an available API key for the specified model, or `null` if all keys are rate limited.

#### `recordUsage(key: string, model: string, tokens: number): Promise<void>`
Records API usage after a successful request.

#### `checkAvailability(model: string): Promise<boolean>`
Checks if at least one key is available for the model.

## Testing

### Run the comprehensive test script:
```bash
npm run test:feeds
```

This script:
1. ✅ Checks rate limit status for all keys
2. ✅ Fetches RSS feeds for a topic
3. ✅ Simulates admin approval flow
4. ✅ Generates social media posts using GROQ
5. ✅ Shows rate limit consumption in real-time
6. ✅ Displays statistics and summaries

### Other test scripts:
```bash
npm run test:user-flow    # Test user subscription and feed flow
npm run test:schedule     # Test scheduled posting
```

## Monitoring Rate Limits

### Programmatic Check
```typescript
import { getAvailableKey, checkAvailability } from "@/lib/rate-limiter"

// Check if any key is available
const isAvailable = await checkAvailability("moonshotai/kimi-k2-instruct")

// Get an available key
const key = await getAvailableKey("moonshotai/kimi-k2-instruct")
if (!key) {
  console.log("All keys are rate limited")
}
```

### Redis CLI Check
```bash
# Connect to Redis
redis-cli -h localhost -p 6380

# View all rate limit keys
KEYS ratelimit:*

# Check specific key usage
GET ratelimit:{keyId}:moonshotai/kimi-k2-instruct:rpm:{window}
```

## Fallback Strategy

If all GROQ keys are rate limited, the system automatically falls back to OpenRouter:

```typescript
// In src/lib/ai.ts
try {
  // Try GROQ with rate limiting
  const apiKey = await getAvailableKey(GROQ_MODEL)
  if (!apiKey) {
    throw new Error("Rate limit exceeded")
  }
  // ... make request
} catch (error) {
  // Fallback to OpenRouter
  const result = await generateText({
    model: openrouter("meta-llama/llama-3.1-70b-instruct"),
    // ... rest of request
  })
}
```

## Best Practices

### 1. Use Multiple Keys in Production
- Acquire 3 GROQ API keys
- Configure them in `GROQ_API_KEYS` environment variable
- Get 3x capacity and better availability

### 2. Monitor Usage
- Run test scripts regularly to check rate limit status
- Monitor Redis for usage patterns
- Set up alerts for when all keys are exhausted

### 3. Handle Rate Limit Errors
- Always check for null return from `getAvailableKey()`
- Have fallback mechanisms (OpenRouter)
- Implement exponential backoff for retries

### 4. Optimize Token Usage
- Keep prompts concise
- Use appropriate context windows
- Monitor token consumption per request

### 5. Redis Configuration
- Ensure Redis is properly configured and persistent
- Use Redis TTL for automatic cleanup
- Monitor Redis memory usage

## Troubleshooting

### Issue: "Rate limit exceeded for all available Groq API keys"

**Cause:** All configured API keys have hit their rate limits.

**Solutions:**
1. Wait for rate limit window to reset (1 minute for RPM, 24 hours for RPD)
2. Add more API keys to `GROQ_API_KEYS`
3. Use fallback provider (OpenRouter)
4. Reduce request frequency

### Issue: Redis connection errors

**Cause:** Redis is not running or misconfigured.

**Solutions:**
1. Check Redis is running: `redis-cli -h localhost -p 6380 ping`
2. Verify `REDIS_URL` in `.env.local`
3. Start Redis: `docker-compose up -d redis`

### Issue: Inaccurate rate limit tracking

**Cause:** Redis data corruption or time sync issues.

**Solutions:**
1. Clear Redis rate limit keys: `redis-cli KEYS "ratelimit:*" | xargs redis-cli DEL`
2. Verify system time is accurate
3. Check Redis TTL is working properly

## Security Considerations

1. **API Key Storage:** Never commit `.env.local` to version control
2. **Key Hashing:** API keys are hashed before storing in Redis
3. **Access Control:** Protect Redis with authentication in production
4. **Cron Security:** Use `CRON_SECRET` to authenticate cron jobs

## Performance Optimization

1. **Pipeline Usage:** Uses Redis pipeline for atomic operations
2. **Batch Processing:** Feeds are processed in batches of 5
3. **Efficient Key Rotation:** O(n) lookup for available keys
4. **TTL-based Cleanup:** Automatic Redis key expiration

## Future Improvements

- [ ] Add metrics/observability (Prometheus, Grafana)
- [ ] Implement predictive rate limit management
- [ ] Add webhook notifications for rate limit warnings
- [ ] Support for additional AI providers
- [ ] Dynamic rate limit adjustment based on usage patterns
