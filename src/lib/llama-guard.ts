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

    const prompt = `You are an extremely strict content quality gate for a curated newsletter focused ONLY on: ${topicContext}.

Your PRIMARY job is to ensure ONLY genuinely topic-focused, high-quality content passes through. You are a gatekeeper — when in doubt, REJECT. Quality over quantity.

${contentToCheck}

=== REJECTION CRITERIA ===
REJECT (flag as unsafe) if ANY of these apply:

1. Sales/Promotional Content:
   - Contains coupon/promo codes (e.g., "SAVE20", "DISCOUNT50", "CODE123")
   - Sales language: "Buy now", "Limited offer", "Get X% off", "Subscribe and save"
   - Affiliate marketing or sponsored promotions
   - Product launches written to drive purchases rather than inform
   - Paid course/product sales with pricing or discounts

2. Sponsored/Ad Content:
   - Sponsored posts, partner content, advertorials, native advertising
   - "Brought to you by", "In partnership with", "Presented by"
   - Press releases that are thinly veiled advertisements
   - Product announcements that read like ads rather than news
   - Content from a company primarily promoting their own product/service
   - "Why we built X" or "Introducing X" posts from product companies

3. Clickbait:
   - Sensational titles: "You won't believe...", "This one trick...", "Mind-blowing..."
   - Headlines that misrepresent or exaggerate the actual content
   - Emotional manipulation for clicks, outrage bait

4. Spam:
   - Low-quality, repetitive, or thin content with no real informational value
   - Gibberish or auto-generated filler
   - Aggregated content with no original insight or analysis

5. Marketing Content:
   - Thought leadership articles that are primarily brand/company promotion
   - Vendor blogs disguised as guides or news — the real goal is driving traffic/leads
   - "How we built X at [Company]" posts that are really sales pitches
   - Content designed to funnel readers toward a product, tool, or service
   - Job-board, recruitment, or hiring marketing posts
   - "Why you should use [product]" or "[Product] vs [Product]" comparison marketing
   - Listicles of tools/products ("Top 10 tools for X") — these are marketing

6. Off-Topic Content (VERY STRICT — this is the most important check):
   - The newsletter is specifically and ONLY about: ${topicName}
   - The article MUST be directly, specifically, and primarily about ${topicName}
   - Tangentially related content is NOT enough — reject it
   - General tech/business/lifestyle content that merely mentions ${topicName} is NOT enough
   - If the article covers multiple topics and ${topicName} is not the PRIMARY focus, reject it
   - If a reader subscribed ONLY for ${topicName} would find this irrelevant or loosely related, reject it
   - If the article could reasonably be published in a newsletter about a DIFFERENT topic, reject it
   - Peripheral mentions, analogies, or passing references to ${topicName} do NOT count

=== APPROVAL CRITERIA ===
APPROVE (mark as safe) ONLY if ALL of these are true:
- The article is genuinely, primarily, and deeply about ${topicName}
- It delivers real news, analysis, research, or technical insight
- There is ZERO sales intent, marketing angle, sponsorship, or promotional drift
- A reader subscribed specifically for ${topicName} content would find this highly relevant and valuable
- The content has substance — not just a headline or a few sentences

=== TOPIC RELEVANCE SCORING ===
Rate how relevant and focused this article is to ${topicName} on a scale of 1-10:
1-3: Not about ${topicName}, or only mentions it in passing
4-5: Somewhat related but not focused on ${topicName}, or covers it as a minor part
6: Related but lacks depth or focus on ${topicName} specifically
7: Primarily about ${topicName} with reasonable depth
8: Strongly focused on ${topicName} with good depth and insight
9-10: Deeply and exclusively about ${topicName}, highly valuable for a ${topicName}-focused audience

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
REASONING: [1-2 sentences. State whether this is genuinely about ${topicName} and why you approved/rejected.]`

    const { text } = await generateText({
      model: groq('meta-llama/llama-guard-4-12b'),
      prompt,
      temperature: 0.2,  // Low temperature for consistent moderation
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
 * Parse Llama Guard response
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
