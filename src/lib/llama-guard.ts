/**
 * Content Moderation & Scoring
 *
 * Uses NVIDIA API with moonshotai/kimi-k2.5 for content quality scoring
 * and topic relevance classification.
 *
 * Previously used Groq's Llama Guard 4 — which was a safety-only model
 * that couldn't follow structured classification prompts reliably.
 * Kimi K2.5 is a general-purpose model that handles nuanced scoring well.
 */

import { generateText } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'

// NVIDIA API provider (OpenAI-compatible)
const nvidia = createOpenAI({
  apiKey: process.env.NVIDIA_API_KEY || '',
  baseURL: 'https://integrate.api.nvidia.com/v1',
})

const SCORING_MODEL = 'moonshotai/kimi-k2.5'

export interface ModerationResult {
  isSafe: boolean
  category: 'safe' | 'unsafe' | 'sales' | 'spam' | 'clickbait' | 'promotional' | 'marketing' | 'offtopic' | 'sponsored'
  confidence: number  // 0-1
  reasoning: string
  topicRelevanceScore: number  // 1-10: how relevant the article is to the topic
  flags: {
    isSalesContent: boolean
    hasPromoCodes: boolean
    isClickbait: boolean
    isSpam: boolean
    isMarketing: boolean
    isOffTopic: boolean
    isSponsored: boolean
    moderationSkipped: boolean
  }
}

/**
 * Check if the scoring model API is properly configured
 */
export function isLlamaGuardConfigured(): boolean {
  return !!process.env.NVIDIA_API_KEY
}

/**
 * Score and moderate content using NVIDIA Kimi K2.5
 *
 * @throws Error if NVIDIA_API_KEY is not configured
 */
export async function moderateContent(
  title: string,
  summary: string | null,
  content: string | null,
  topicName: string,
  topicDescription: string | null
): Promise<ModerationResult> {
  if (!isLlamaGuardConfigured()) {
    throw new Error(
      'NVIDIA_API_KEY is not configured. Please add NVIDIA_API_KEY to your .env file. ' +
      'Get your API key from: https://build.nvidia.com/'
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

    const prompt = `You are a content quality filter for a curated newsletter about: ${topicContext}.

Your job is to score content for topic relevance and filter out spam, ads, and promotional content. Be fair and balanced — approve good content that is relevant to the topic, even if it's not perfect.

${contentToCheck}

=== REJECTION CRITERIA ===
REJECT (flag as unsafe) if ANY of these clearly apply:

1. Sales/Promotional Content:
   - Contains coupon/promo codes (e.g., "SAVE20", "DISCOUNT50")
   - Aggressive sales language: "Buy now", "Limited offer", "Get X% off"
   - Affiliate marketing or sponsored promotions
   - Paid course/product sales with pricing or discounts

2. Sponsored/Ad Content:
   - Sponsored posts, partner content, advertorials, native advertising
   - "Brought to you by", "In partnership with", "Presented by"
   - Press releases that are thinly veiled advertisements

3. Clickbait:
   - Sensational titles: "You won't believe...", "This one trick..."
   - Headlines that clearly misrepresent the content
   - Outrage bait with no substance

4. Spam:
   - Low-quality, repetitive, or thin content with no informational value
   - Gibberish or auto-generated filler

5. Marketing Content:
   - Content whose PRIMARY purpose is selling a product or service
   - Vendor blogs where the real goal is driving sales leads, not informing
   - Job-board or recruitment marketing
   - NOTE: Engineering blog posts explaining how something was built are NOT marketing — they are valuable technical content even if from a company blog

6. Off-Topic Content:
   - The article should be meaningfully related to ${topicName}
   - Content that has nothing to do with ${topicName} should be rejected
   - However, articles that cover ${topicName} as one of several topics are acceptable if ${topicName} is a significant part
   - Industry news, trends, and analysis related to ${topicName} are on-topic

=== APPROVAL CRITERIA ===
APPROVE (mark as safe) if the article:
- Is meaningfully about or related to ${topicName}
- Delivers news, analysis, research, tutorials, or technical insight
- Is not primarily a sales pitch or advertisement
- Has substance and informational value

=== TOPIC RELEVANCE SCORING ===
Rate how relevant this article is to ${topicName} on a scale of 1-10:
1-2: Not about ${topicName} at all
3-4: Barely related, only mentions ${topicName} in passing
5-6: Somewhat related to ${topicName} but not the main focus
7: Primarily about ${topicName} with reasonable depth
8: Strongly focused on ${topicName} with good insight
9-10: Deeply and specifically about ${topicName}, highly valuable

Respond with ONLY this exact format:
CATEGORY: [safe/unsafe/sales/clickbait/spam/marketing/offtopic/sponsored]
CONFIDENCE: [0.0-1.0]
TOPIC_RELEVANCE: [1-10]
SALES_CONTENT: [yes/no]
PROMO_CODES: [yes/no]
CLICKBAIT: [yes/no]
SPAM: [yes/no]
MARKETING: [yes/no]
SPONSORED: [yes/no]
OFF_TOPIC: [yes/no]
REASONING: [1-2 sentences. State whether this is relevant to ${topicName} and why you approved/rejected.]`

    const { text } = await generateText({
      model: nvidia(SCORING_MODEL),
      prompt,
      temperature: 0.2,
    })

    // Log raw response for debugging
    console.log(`  🤖 Model response: ${text.substring(0, 200)}`)

    return parseGuardResponse(text)

  } catch (error) {
    console.error('Content moderation failed:', error)

    // Fail-safe: moderation skipped — item goes to pending review
    return {
      isSafe: true,
      category: 'safe',
      confidence: 0.5,
      reasoning: 'Moderation check failed — needs manual review',
      topicRelevanceScore: 5,
      flags: {
        isSalesContent: false,
        hasPromoCodes: false,
        isClickbait: false,
        isSpam: false,
        isMarketing: false,
        isOffTopic: false,
        isSponsored: false,
        moderationSkipped: true
      }
    }
  }
}

/**
 * Parse structured moderation response
 */
function parseGuardResponse(text: string): ModerationResult {
  const lines = text.split('\n').map(l => l.trim())

  let category: ModerationResult['category'] = 'safe'
  let confidence = 0.8
  let topicRelevance = 5
  let salesContent = false
  let promoCodes = false
  let clickbait = false
  let spam = false
  let marketing = false
  let sponsored = false
  let offTopic = false
  let reasoning = ''

  for (const line of lines) {
    if (line.startsWith('CATEGORY:')) {
      const cat = line.split(':')[1].trim().toLowerCase()
      if (cat.includes('unsafe') || cat.includes('sales') ||
          cat.includes('clickbait') || cat.includes('spam') ||
          cat.includes('marketing') || cat.includes('offtopic') ||
          cat.includes('sponsored')) {
        category = cat as ModerationResult['category']
      }
    }
    else if (line.startsWith('CONFIDENCE:')) {
      confidence = parseFloat(line.split(':')[1].trim())
      if (isNaN(confidence)) confidence = 0.8
    }
    else if (line.startsWith('TOPIC_RELEVANCE:')) {
      topicRelevance = parseInt(line.split(':')[1].trim())
      if (isNaN(topicRelevance)) topicRelevance = 5
      topicRelevance = Math.max(1, Math.min(10, topicRelevance))
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
    else if (line.startsWith('SPONSORED:')) {
      sponsored = line.toLowerCase().includes('yes')
    }
    else if (line.startsWith('OFF_TOPIC:')) {
      offTopic = line.toLowerCase().includes('yes')
    }
    else if (line.startsWith('REASONING:')) {
      reasoning = line.substring('REASONING:'.length).trim()
    }
  }

  const isSafe = category === 'safe' &&
    !salesContent && !promoCodes && !clickbait &&
    !spam && !marketing && !sponsored && !offTopic

  return {
    isSafe,
    category,
    confidence,
    reasoning: reasoning || `Content categorized as ${category}`,
    topicRelevanceScore: topicRelevance,
    flags: {
      isSalesContent: salesContent,
      hasPromoCodes: promoCodes,
      isClickbait: clickbait,
      isSpam: spam,
      isMarketing: marketing,
      isOffTopic: offTopic,
      isSponsored: sponsored,
      moderationSkipped: false
    }
  }
}

/**
 * Rate limiter for scoring API
 * Enforces minimum interval between requests
 */
export class LlamaGuardRateLimiter {
  private queue: Array<() => Promise<any>> = []
  private processing = false
  private lastRequestTime = 0
  private readonly minInterval = 1000  // 1 second between requests

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

    const now = Date.now()
    const timeSinceLastRequest = now - this.lastRequestTime
    const waitTime = Math.max(0, this.minInterval - timeSinceLastRequest)

    if (waitTime > 0) {
      await new Promise(resolve => setTimeout(resolve, waitTime))
    }

    this.lastRequestTime = Date.now()

    await fn()

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
  if (!isLlamaGuardConfigured()) {
    console.warn('⚠️  NVIDIA_API_KEY not configured - skipping AI moderation')
    return {
      isSafe: true,
      category: 'safe',
      confidence: 0.5,
      reasoning: 'AI moderation skipped — NVIDIA_API_KEY not configured',
      topicRelevanceScore: 5,
      flags: {
        isSalesContent: false,
        hasPromoCodes: false,
        isClickbait: false,
        isSpam: false,
        isMarketing: false,
        isOffTopic: false,
        isSponsored: false,
        moderationSkipped: true
      }
    }
  }

  return guardRateLimiter.enqueue(() =>
    moderateContent(title, summary, content, topicName, topicDescription)
  )
}
