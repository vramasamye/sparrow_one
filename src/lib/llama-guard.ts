/**
 * Llama Guard 4 Content Moderation
 *
 * Uses Groq's meta-llama/llama-guard-4-12b model for content filtering
 *
 * RATE LIMITS (STRICT):
 * - RPM: 30 (1 request every 2 seconds)
 * - RPD: 14,400
 * - TPM: 15,000
 * - TPD: 500,000
 */

import { generateText } from 'ai'
import { groq } from '@ai-sdk/groq'

export interface ModerationResult {
  isSafe: boolean
  category: 'safe' | 'unsafe' | 'sales' | 'spam' | 'clickbait' | 'promotional' | 'marketing' | 'offtopic'
  confidence: number  // 0-1
  reasoning: string
  flags: {
    isSalesContent: boolean
    hasPromoCodes: boolean
    isClickbait: boolean
    isSpam: boolean
    isMarketing: boolean
    isOffTopic: boolean
    moderationSkipped: boolean
  }
}

/**
 * Check if Llama Guard is properly configured
 */
export function isLlamaGuardConfigured(): boolean {
  const apiKey = process.env.GROQ_API_KEY || process.env.GROQ_API_KEYS
  return !!apiKey
}

/**
 * Moderate content using Llama Guard 4
 *
 * @throws Error if GROQ_API_KEY is not configured
 */
export async function moderateContent(
  title: string,
  summary: string | null,
  content: string | null,
  topicName: string,
  topicDescription: string | null
): Promise<ModerationResult> {
  // Validate API key is configured
  if (!isLlamaGuardConfigured()) {
    throw new Error(
      'GROQ_API_KEY is not configured. Please add GROQ_API_KEY to your .env file. ' +
      'Get your API key from: https://console.groq.com/keys'
    )
  }

  try {
    const contentToCheck = `
Title: ${title}

Summary: ${summary || 'N/A'}

Content Preview: ${content ? content.substring(0, 500) : 'N/A'}
`.trim()

    const topicContext = topicDescription
      ? `${topicName} — ${topicDescription}`
      : topicName

    const prompt = `You are a strict content moderation system for a newsletter focused on: ${topicContext}.

Your job is to reject anything that is not genuinely valuable, on-topic content. Be strict — when in doubt, flag it.

${contentToCheck}

REJECT (flag as unsafe) if ANY of these apply:

1. Sales/Promotional Content:
   - Contains coupon/promo codes (e.g., "SAVE20", "DISCOUNT50", "CODE123")
   - Sales language: "Buy now", "Limited offer", "Get X% off", "Subscribe and save"
   - Affiliate marketing or sponsored promotions
   - Paid course/product sales with discounts

2. Clickbait:
   - Sensational titles: "You won't believe...", "This one trick..."
   - Headlines that misrepresent or exaggerate the actual content

3. Spam:
   - Low-quality, repetitive, or thin content with no real informational value
   - Gibberish or auto-generated filler

4. Marketing Content:
   - Thought leadership articles that are primarily brand promotion
   - Vendor blogs disguised as guides or news — the real goal is driving traffic or leads
   - "How we built X at [Company]" posts that are really sales pitches
   - Content designed to funnel readers toward a product or service
   - Job-board or recruitment marketing posts

5. Off-Topic Content (STRICT):
   - The newsletter is specifically about: ${topicName}
   - Reject if the article is NOT directly and specifically about ${topicName}
   - Tangentially related content is NOT enough — it must be core to the topic
   - General tech, business, or lifestyle content that only peripherally mentions ${topicName} should be rejected

APPROVE (mark as safe) ONLY if ALL of these are true:
- The article is genuinely and primarily about ${topicName}
- It delivers real news, analysis, or technical insight
- There is no sales intent, marketing angle, or off-topic drift

Respond with ONLY this exact format:
CATEGORY: [safe/unsafe/sales/clickbait/spam/marketing/offtopic]
CONFIDENCE: [0.0-1.0]
SALES_CONTENT: [yes/no]
PROMO_CODES: [yes/no]
CLICKBAIT: [yes/no]
SPAM: [yes/no]
MARKETING: [yes/no]
OFF_TOPIC: [yes/no]
REASONING: [1-2 sentences. If rejecting, explain why. Always state whether this is genuinely about ${topicName}.]`

    const { text } = await generateText({
      model: groq('meta-llama/llama-guard-4-12b'),
      prompt,
      temperature: 0.2,  // Low temperature for consistent moderation
      // maxTokens: 200 // Commented out to fix TS error: Object literal may only specify known properties
    })

    // Parse the response
    return parseGuardResponse(text)

  } catch (error) {
    console.error('Llama Guard moderation failed:', error)

    // Fail-safe: moderation skipped — item goes to pending review (no auto-approve, no score-based auto-reject)
    return {
      isSafe: true,
      category: 'safe',
      confidence: 0.5,
      reasoning: 'Moderation check failed — needs manual review',
      flags: {
        isSalesContent: false,
        hasPromoCodes: false,
        isClickbait: false,
        isSpam: false,
        isMarketing: false,
        isOffTopic: false,
        moderationSkipped: true
      }
    }
  }
}

/**
 * Parse Llama Guard response
 */
function parseGuardResponse(text: string): ModerationResult {
  const lines = text.split('\n').map(l => l.trim())

  let category: ModerationResult['category'] = 'safe'
  let confidence = 0.8
  let salesContent = false
  let promoCodes = false
  let clickbait = false
  let spam = false
  let marketing = false
  let offTopic = false
  let reasoning = ''

  for (const line of lines) {
    if (line.startsWith('CATEGORY:')) {
      const cat = line.split(':')[1].trim().toLowerCase()
      if (cat.includes('unsafe') || cat.includes('sales') ||
          cat.includes('clickbait') || cat.includes('spam') ||
          cat.includes('marketing') || cat.includes('offtopic')) {
        category = cat as ModerationResult['category']
      }
    }
    else if (line.startsWith('CONFIDENCE:')) {
      confidence = parseFloat(line.split(':')[1].trim())
    }
    else if (line.startsWith('SALES_CONTENT:')) {
      salesContent = line.toLowerCase().includes('yes')
    }
    else if (line.startsWith('PROMO_CODES:')) {
      promoCodes = line.toLowerCase().includes('yes')
    }
    else if (line.startsWith('CLICKBAIT:')) {
      clickbait = line.toLowerCase().includes('yes')
    }
    else if (line.startsWith('SPAM:')) {
      spam = line.toLowerCase().includes('yes')
    }
    else if (line.startsWith('MARKETING:')) {
      marketing = line.toLowerCase().includes('yes')
    }
    else if (line.startsWith('OFF_TOPIC:')) {
      offTopic = line.toLowerCase().includes('yes')
    }
    else if (line.startsWith('REASONING:')) {
      reasoning = line.substring('REASONING:'.length).trim()
    }
  }

  const isSafe = category === 'safe' && !salesContent && !promoCodes && !clickbait && !spam && !marketing && !offTopic

  return {
    isSafe,
    category,
    confidence,
    reasoning: reasoning || `Content categorized as ${category}`,
    flags: {
      isSalesContent: salesContent,
      hasPromoCodes: promoCodes,
      isClickbait: clickbait,
      isSpam: spam,
      isMarketing: marketing,
      isOffTopic: offTopic,
      moderationSkipped: false
    }
  }
}

/**
 * Rate limiter for Llama Guard API
 * Ensures we stay under 30 RPM limit
 */
export class LlamaGuardRateLimiter {
  private queue: Array<() => Promise<any>> = []
  private processing = false
  private lastRequestTime = 0
  private readonly minInterval = 2000  // 2 seconds between requests (30 RPM)

  async enqueue<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.queue.push(async () => {
        try {
          const result = await fn()
          resolve(result)
        } catch (error) {
          reject(error)
        }
      })

      if (!this.processing) {
        this.processQueue()
      }
    })
  }

  private async processQueue() {
    if (this.queue.length === 0) {
      this.processing = false
      return
    }

    this.processing = true
    const fn = this.queue.shift()!

    // Enforce rate limit: wait 2 seconds since last request
    const now = Date.now()
    const timeSinceLastRequest = now - this.lastRequestTime
    const waitTime = Math.max(0, this.minInterval - timeSinceLastRequest)

    if (waitTime > 0) {
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }

    this.lastRequestTime = Date.now()

    // Execute the function
    await fn()

    // Process next item
    this.processQueue()
  }

  getQueueSize(): number {
    return this.queue.length
  }
}

// Global rate limiter instance
export const guardRateLimiter = new LlamaGuardRateLimiter()

/**
 * Moderate content with automatic rate limiting
 * Returns a safe default result if API key is not configured
 */
export async function moderateContentSafe(
  title: string,
  summary: string | null,
  content: string | null,
  topicName: string,
  topicDescription: string | null
): Promise<ModerationResult> {
  // If API key not configured, skip moderation — items will go to pending review
  if (!isLlamaGuardConfigured()) {
    console.warn('⚠️  GROQ_API_KEY not configured - skipping AI moderation')
    return {
      isSafe: true,
      category: 'safe',
      confidence: 0.5,
      reasoning: 'AI moderation skipped — GROQ_API_KEY not configured',
      flags: {
        isSalesContent: false,
        hasPromoCodes: false,
        isClickbait: false,
        isSpam: false,
        isMarketing: false,
        isOffTopic: false,
        moderationSkipped: true
      }
    }
  }

  return guardRateLimiter.enqueue(() =>
    moderateContent(title, summary, content, topicName, topicDescription)
  )
}
