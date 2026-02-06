import { redis } from "@/lib/redis"

export interface ModelLimits {
  rpm: number // Requests per minute
  rpd: number // Requests per day
  tpm: number // Tokens per minute
  tpd: number // Tokens per day
}

// STRICT RATE LIMITS - These are hard limits enforced by GROQ
// Each API key has these limits independently
export const MODEL_LIMITS: Record<string, ModelLimits> = {
  "moonshotai/kimi-k2-instruct": {
    rpm: 40,        // 40 requests per minute
    rpd: 1000,      // 1K requests per day
    tpm: 9000,      // 9K tokens per minute
    tpd: 250000,    // 250K tokens per day
  },
  "moonshotai/kimi-k2-instruct-0905": {
    rpm: 40,        // 40 requests per minute
    rpd: 1000,      // 1K requests per day
    tpm: 9000,      // 9K tokens per minute
    tpd: 250000,    // 250K tokens per day
  },
  "meta-llama/llama-guard-4-12b": {
    rpm: 20,        // 20 requests per minute
    rpd: 13000,     // 13K requests per day
    tpm: 15000,     // 15K tokens per minute
    tpd: 500000,    // 500K tokens per day
  },
  "moonshotai/kimi-k2.5": {
    rpm: 60,        // NVIDIA API — generous limits
    rpd: 50000,     // 50K requests per day
    tpm: 30000,     // 30K tokens per minute
    tpd: 1000000,   // 1M tokens per day
  },
  // Default fallback limits (conservative)
  "default": {
    rpm: 10,
    rpd: 500,
    tpm: 5000,
    tpd: 100000,
  }
}

// Get keys from environment variable
const API_KEYS = (process.env.GROQ_API_KEYS || "").split(",").map(k => k.trim()).filter(Boolean)

if (API_KEYS.length === 0 && process.env.GROQ_API_KEY) {
  API_KEYS.push(process.env.GROQ_API_KEY)
}

/**
 * Get the best available API key for a specific model
 */
export async function getAvailableKey(model: string): Promise<string | null> {
  const limits = MODEL_LIMITS[model] || MODEL_LIMITS["default"]
  
  for (const key of API_KEYS) {
    // We use a hash of the key to store stats securely/shortly in Redis
    const keyId = Buffer.from(key).toString('base64').substring(0, 10)
    
    const now = Date.now()
    const minuteWindow = Math.floor(now / 60000)
    const dayWindow = Math.floor(now / 86400000)
    
    // Redis keys
    const rpmKey = `ratelimit:${keyId}:${model}:rpm:${minuteWindow}`
    const rpdKey = `ratelimit:${keyId}:${model}:rpd:${dayWindow}`
    const tpmKey = `tokenlimit:${keyId}:${model}:tpm:${minuteWindow}`
    const tpdKey = `tokenlimit:${keyId}:${model}:tpd:${dayWindow}`
    
    // Fetch current usage
    const [reqMin, reqDay, tokMin, tokDay] = await redis.mget(rpmKey, rpdKey, tpmKey, tpdKey)
    
    const currentRpm = parseInt(reqMin || "0", 10)
    const currentRpd = parseInt(reqDay || "0", 10)
    const currentTpm = parseInt(tokMin || "0", 10)
    const currentTpd = parseInt(tokDay || "0", 10)
    
    // Check limits
    if (
      currentRpm < limits.rpm &&
      currentRpd < limits.rpd &&
      currentTpm < limits.tpm &&
      currentTpd < limits.tpd
    ) {
      return key
    }
  }
  
  return null
}

/**
 * Record usage after a request
 */
export async function recordUsage(key: string, model: string, tokens: number): Promise<void> {
  const keyId = Buffer.from(key).toString('base64').substring(0, 10)
  const now = Date.now()
  const minuteWindow = Math.floor(now / 60000)
  const dayWindow = Math.floor(now / 86400000)
  
  const rpmKey = `ratelimit:${keyId}:${model}:rpm:${minuteWindow}`
  const rpdKey = `ratelimit:${keyId}:${model}:rpd:${dayWindow}`
  const tpmKey = `tokenlimit:${keyId}:${model}:tpm:${minuteWindow}`
  const tpdKey = `tokenlimit:${keyId}:${model}:tpd:${dayWindow}`
  
  const pipeline = redis.pipeline()
  
  // Increment counters
  pipeline.incr(rpmKey)
  pipeline.incr(rpdKey)
  pipeline.incrby(tpmKey, tokens)
  pipeline.incrby(tpdKey, tokens)
  
  // Set expiration (1 minute for minute windows, 24 hours + buffer for day windows)
  pipeline.expire(rpmKey, 60)
  pipeline.expire(tpmKey, 60)
  pipeline.expire(rpdKey, 86400 * 2) // Keep daily stats for 2 days
  pipeline.expire(tpdKey, 86400 * 2)
  
  await pipeline.exec()
}

/**
 * Check if the system is available for a given model (at least one key is free)
 */
export async function checkAvailability(model: string = "moonshotai/kimi-k2-instruct"): Promise<boolean> {
    const key = await getAvailableKey(model)
    return !!key
}

/**
 * Get status of the system (legacy support for GET endpoint)
 */
export async function getRateLimitStatus(model: string = "moonshotai/kimi-k2-instruct") {
    const available = await checkAvailability(model)
    // We can't easily calculate "wait time" because there are multiple keys.
    // If unavailable, we just say "busy".
    return {
        canRequest: available,
        waitSeconds: available ? 0 : 60, // Arbitrary wait time if busy
        remainingToday: 100, // Dummy value as we have multiple keys
        dailyLimit: 1000 // Dummy value
    }
}

/**
 * Wait for an available key with retry logic (for background tasks)
 * This function will wait and retry until a key becomes available
 *
 * @param model - The model to check for
 * @param maxWaitMinutes - Maximum time to wait in minutes (default: 10)
 * @param checkIntervalSeconds - How often to check in seconds (default: 30)
 * @returns Available API key or null if timeout reached
 */
export async function waitForAvailableKey(
  model: string,
  maxWaitMinutes: number = 10,
  checkIntervalSeconds: number = 30
): Promise<string | null> {
  const maxAttempts = Math.floor((maxWaitMinutes * 60) / checkIntervalSeconds)
  let attempts = 0

  while (attempts < maxAttempts) {
    const key = await getAvailableKey(model)

    if (key) {
      if (attempts > 0) {
        console.log(`✅ Key became available after ${attempts * checkIntervalSeconds}s`)
      }
      return key
    }

    attempts++
    if (attempts < maxAttempts) {
      console.log(`⏳ All keys rate limited. Waiting ${checkIntervalSeconds}s... (attempt ${attempts}/${maxAttempts})`)
      await new Promise(resolve => setTimeout(resolve, checkIntervalSeconds * 1000))
    }
  }

  console.log(`❌ No keys became available after ${maxWaitMinutes} minutes`)
  return null
}

/**
 * Get detailed rate limit status for all keys
 */
export async function getDetailedRateLimitStatus(model: string = "moonshotai/kimi-k2-instruct") {
  const limits = MODEL_LIMITS[model] || MODEL_LIMITS["default"]
  const keyStatuses = []

  for (let i = 0; i < API_KEYS.length; i++) {
    const key = API_KEYS[i]
    const keyId = Buffer.from(key).toString('base64').substring(0, 10)
    const now = Date.now()
    const minuteWindow = Math.floor(now / 60000)
    const dayWindow = Math.floor(now / 86400000)

    const rpmKey = `ratelimit:${keyId}:${model}:rpm:${minuteWindow}`
    const rpdKey = `ratelimit:${keyId}:${model}:rpd:${dayWindow}`
    const tpmKey = `tokenlimit:${keyId}:${model}:tpm:${minuteWindow}`
    const tpdKey = `tokenlimit:${keyId}:${model}:tpd:${dayWindow}`

    const [reqMin, reqDay, tokMin, tokDay] = await redis.mget(rpmKey, rpdKey, tpmKey, tpdKey)

    const currentRpm = parseInt(reqMin || "0", 10)
    const currentRpd = parseInt(reqDay || "0", 10)
    const currentTpm = parseInt(tokMin || "0", 10)
    const currentTpd = parseInt(tokDay || "0", 10)

    keyStatuses.push({
      keyIndex: i + 1,
      keyId,
      requests: {
        perMinute: { used: currentRpm, limit: limits.rpm, available: limits.rpm - currentRpm },
        perDay: { used: currentRpd, limit: limits.rpd, available: limits.rpd - currentRpd }
      },
      tokens: {
        perMinute: { used: currentTpm, limit: limits.tpm, available: limits.tpm - currentTpm },
        perDay: { used: currentTpd, limit: limits.tpd, available: limits.tpd - currentTpd }
      },
      isAvailable: currentRpm < limits.rpm && currentRpd < limits.rpd && currentTpm < limits.tpm && currentTpd < limits.tpd
    })
  }

  return {
    model,
    totalKeys: API_KEYS.length,
    availableKeys: keyStatuses.filter(k => k.isAvailable).length,
    keys: keyStatuses
  }
}
