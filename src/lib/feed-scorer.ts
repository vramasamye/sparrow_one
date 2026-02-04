/**
 * Feed Scoring System
 * Combines rule-based scoring + Llama Guard moderation
 */

import { prisma } from './prisma'
import { moderateContentSafe } from './llama-guard'

export interface ScoringResult {
  qualityScore: number      // 0-100
  ruleBasedScore: number    // 0-50
  moderationBoost: number   // -50 to +50
  autoApprove: boolean
  autoReject: boolean
  reasoning: string
}

// ========================================
// CROSS-FEED DUPLICATE DETECTION
// ========================================

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'shall',
  'should', 'may', 'might', 'must', 'can', 'could', 'to', 'of', 'in',
  'for', 'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through',
  'during', 'before', 'after', 'above', 'below', 'between', 'out', 'off',
  'over', 'under', 'again', 'further', 'then', 'once', 'here', 'there',
  'when', 'where', 'why', 'how', 'all', 'both', 'each', 'few', 'more',
  'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own',
  'same', 'so', 'than', 'too', 'very', 'just', 'because', 'but', 'and',
  'or', 'if', 'while', 'although', 'though', 'even', 'also', 'still',
  'already', 'yet', 'now', 'new', 'its', 'their', 'our', 'your', 'his',
  'her', 'my', 'it', 'this', 'that', 'these', 'those', 'what', 'which',
  'who', 'whom', 'up', 'about', 'one'
])

/** Extract meaningful words from a title (lowercase, no punctuation, no stop words) */
function getTitleWords(title: string): Set<string> {
  return new Set(
    title.toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(w => w.length > 1 && !STOP_WORDS.has(w))
  )
}

/**
 * Overlap coefficient between two word sets.
 * intersection / min(|A|, |B|) — catches duplicates where one title is a subset of the other.
 */
function overlapCoefficient(wordsA: Set<string>, wordsB: Set<string>): number {
  if (wordsA.size === 0 || wordsB.size === 0) return 0
  const intersection = [...wordsA].filter(w => wordsB.has(w))
  return intersection.length / Math.min(wordsA.size, wordsB.size)
}

/**
 * Find a cross-feed duplicate within the same topic (24h window).
 * Skips comparison if either title has fewer than 3 meaningful words.
 */
async function findDuplicateFeed(
  feed: { id: string; topicId: string; title: string }
): Promise<{ id: string; title: string } | null> {
  const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)

  const recentFeeds = await prisma.feed.findMany({
    where: {
      topicId: feed.topicId,
      id: { not: feed.id },
      status: { not: 'REJECTED' },
      createdAt: { gte: twentyFourHoursAgo }
    },
    select: { id: true, title: true }
  })

  const currentWords = getTitleWords(feed.title)
  if (currentWords.size < 3) return null  // Too short to compare reliably

  for (const recent of recentFeeds) {
    const recentWords = getTitleWords(recent.title)
    if (recentWords.size < 3) continue

    if (overlapCoefficient(currentWords, recentWords) >= 0.7) {
      return recent
    }
  }

  return null
}

/**
 * Source authority scores (whitelist)
 */
const SOURCE_AUTHORITY: Record<string, number> = {
  // Tier 1: Premier Tech News (20 points)
  'techcrunch.com': 20,
  'theverge.com': 20,
  'arstechnica.com': 20,
  'wired.com': 20,
  'engadget.com': 20,
  'venturebeat.com': 20,
  'cnet.com': 20,

  // Business & Finance Tech Coverage (19 points)
  'bloomberg.com': 19,
  'reuters.com': 19,
  'wsj.com': 19,
  'ft.com': 19,
  'businessinsider.com': 18,
  'forbes.com': 18,

  // Influential Individual/Niche Blogs (19 points) - Elevated from Tier 5
  'krebsonsecurity.com': 19,
  'troyhunt.com': 19,
  'simonwillison.net': 19,
  'paulgraham.com': 19,
  'daringfireball.net': 19,
  'pluralistic.net': 19,
  'antirez.com': 19,
  'jeffgeerling.com': 19,
  'mitchellh.com': 19,
  'lucumr.pocoo.org': 19,
  'steveblank.com': 19,
  'gwern.net': 19,
  'garymarcus.substack.com': 19,
  'lcamtuf.substack.com': 19,
  'derekthompson.org': 19,

  // Tier 2: Official Company Blogs (18 points)
  'openai.com': 18,
  'vercel.com': 18,
  'blog.google': 18,
  'ai.google': 18,
  'engineering.fb.com': 18,
  'aws.amazon.com': 18,
  'github.blog': 18,
  'developers.google.com': 18,

  // Tier 3: Industry Publications (16 points)
  'siliconangle.com': 16,
  'zdnet.com': 16,
  'computerworld.com': 16,

  // Tier 4: Popular Dev Blogs (14 points)
  'dev.to': 14,
  'medium.com': 14,
  'hackernoon.com': 14,
  'smashingmagazine.com': 14,

  // Tier 5: Individual Blogs (10 points) - default
}

/**
 * Score a feed
 */
export async function scoreFeed(feedId: string): Promise<ScoringResult> {
  const feed = await prisma.feed.findUnique({
    where: { id: feedId },
    include: {
      topic: true,
      rssFeed: true
    }
  })

  if (!feed) throw new Error('Feed not found')

  // ========================================
  // PRE-CHECK: Cross-feed duplicate detection
  // Runs before LLM to avoid wasting API calls on duplicates
  // ========================================

  const duplicate = await findDuplicateFeed(feed)
  if (duplicate) {
    const reasoning = `Duplicate: same story already exists as "${duplicate.title.substring(0, 60)}"`

    await prisma.feed.update({
      where: { id: feedId },
      data: {
        autoRejected: true,
        qualityScore: 0,
        scoredAt: new Date(),
        moderationReasoning: reasoning
      }
    })

    console.log(`  ❌ Duplicate: "${feed.title.substring(0, 40)}..." matches "${duplicate.title.substring(0, 40)}..."`)

    return {
      qualityScore: 0,
      ruleBasedScore: 0,
      moderationBoost: 0,
      autoApprove: false,
      autoReject: true,
      reasoning
    }
  }

  // ========================================
  // PHASE 1: RULE-BASED SCORING (0-60)
  // ========================================

  // 1. Source Authority (0-20)
  const sourceScore = getSourceAuthorityScore(feed.rssFeed.url, feed.rssFeed.authorityScore)

  // 2. Recency (0-15)
  const recencyScore = getRecencyScore(feed.publishedAt)

  // 3. Metadata Quality (0-10)
  const metadataScore = getMetadataScore(feed)

  // 4. Content Relevance (0-15) - NEW!
  const relevanceScore = getContentRelevanceScore(feed)

  const ruleBasedScore = sourceScore + recencyScore + metadataScore + relevanceScore

  // ========================================
  // PHASE 2: LLAMA GUARD MODERATION
  // ========================================

  console.log(`📝 Moderating: "${feed.title.substring(0, 60)}..."`)

  const moderation = await moderateContentSafe(
    feed.title,
    feed.summary,
    feed.content,
    feed.topic.name,
    feed.topic.description
  )

  // Calculate moderation boost/penalty
  let moderationBoost = 0

  if (!moderation.isSafe) {
    // Heavy penalty for unsafe content
    moderationBoost = -60
  } else {
    // Boost for high-confidence safe content
    // 0.5 confidence = +0 points
    // 0.8 confidence = +15 points
    // 1.0 confidence = +25 points
    moderationBoost = Math.round((moderation.confidence - 0.5) * 50)
  }

  // ========================================
  // PHASE 3: FINAL SCORE & DECISION
  // ========================================

  const qualityScore = Math.max(0, Math.min(100, ruleBasedScore + moderationBoost))

  // Auto-rejection rules (STRICT)
  // Score-based rejection only fires when moderation actually ran — if LLM was skipped,
  // items fall through to pending review rather than being score-rejected blind.
  const autoReject =
    !moderation.isSafe ||
    moderation.flags.isSalesContent ||
    moderation.flags.hasPromoCodes ||
    moderation.flags.isClickbait ||
    moderation.flags.isSpam ||
    moderation.flags.isMarketing ||
    moderation.flags.isOffTopic ||
    (!moderation.flags.moderationSkipped && qualityScore < 50)

  // Auto-approval rules (VERY STRICT)
  // Requires: moderation ran successfully, all flags clean, high quality score.
  // If LLM was skipped for any reason, item cannot auto-approve.
  const autoApprove =
    !moderation.flags.moderationSkipped &&
    moderation.isSafe &&
    !moderation.flags.isSalesContent &&
    !moderation.flags.hasPromoCodes &&
    !moderation.flags.isClickbait &&
    !moderation.flags.isSpam &&
    !moderation.flags.isMarketing &&
    !moderation.flags.isOffTopic &&
    qualityScore >= 82

  // Generate reasoning
  let reasoning = moderation.reasoning

  if (autoReject) {
    const reasons = []
    if (!moderation.isSafe) reasons.push(`Unsafe content (${moderation.category})`)
    if (moderation.flags.isSalesContent) reasons.push('Sales/promotional content')
    if (moderation.flags.hasPromoCodes) reasons.push('Contains promo codes')
    if (moderation.flags.isClickbait) reasons.push('Clickbait detected')
    if (moderation.flags.isSpam) reasons.push('Spam detected')
    if (moderation.flags.isMarketing) reasons.push('Marketing content')
    if (moderation.flags.isOffTopic) reasons.push('Off-topic')
    if (!moderation.flags.moderationSkipped && qualityScore < 50) reasons.push(`Low quality score (${qualityScore})`)
    reasoning = `Auto-rejected: ${reasons.join(', ')}`
  } else if (autoApprove) {
    reasoning = `Auto-approved: High quality (${qualityScore}) and safe content`
  } else {
    reasoning = `Pending review: Score ${qualityScore}, ${moderation.reasoning}`
  }

  // ========================================
  // PHASE 4: UPDATE DATABASE
  // ========================================

  await prisma.feed.update({
    where: { id: feedId },
    data: {
      sourceAuthorityScore: sourceScore,
      recencyScore,
      metadataScore,
      qualityScore,

      // Moderation results
      moderationScore: moderation.confidence,
      moderationCategory: moderation.category,
      moderationReasoning: moderation.reasoning,

      // Flags
      isSafe: moderation.isSafe,
      isSalesContent: moderation.flags.isSalesContent,
      hasPromoCodes: moderation.flags.hasPromoCodes,
      isClickbait: moderation.flags.isClickbait,
      isSpam: moderation.flags.isSpam,
      isMarketing: moderation.flags.isMarketing,
      isOffTopic: moderation.flags.isOffTopic,

      autoApproved: autoApprove,
      autoRejected: autoReject,
      scoredAt: new Date()
    }
  })

  console.log(`  ${autoApprove ? '✅' : autoReject ? '❌' : '⏳'} Score: ${qualityScore} | ${reasoning.substring(0, 60)}`)

  return {
    qualityScore,
    ruleBasedScore,
    moderationBoost,
    autoApprove,
    autoReject,
    reasoning
  }
}

// ========================================
// HELPER FUNCTIONS
// ========================================

function getSourceAuthorityScore(feedUrl: string, learnedScore?: number): number {
  // Use learned score if available
  if (learnedScore && learnedScore > 0) {
    return Math.min(20, learnedScore)
  }

  // Otherwise use domain-based lookup
  const domain = extractDomain(feedUrl)
  return SOURCE_AUTHORITY[domain] || 10  // Default: 10 points
}

function getRecencyScore(publishedAt: Date | null): number {
  if (!publishedAt) return 0

  const hoursOld = (Date.now() - publishedAt.getTime()) / (1000 * 60 * 60)

  if (hoursOld <= 2)   return 15  // Breaking news!
  if (hoursOld <= 6)   return 13  // Very fresh
  if (hoursOld <= 12)  return 10  // Fresh
  if (hoursOld <= 24)  return 7   // Today
  if (hoursOld <= 48)  return 4   // Yesterday
  return 0                         // Too old
}

function getMetadataScore(feed: any): number {
  let score = 0

  if (feed.imageUrl) score += 3                              // Has featured image
  if (feed.author) score += 2                                // Has author
  if (feed.summary && feed.summary.length > 100) score += 3  // Good summary
  if (feed.content && feed.content.length > 500) score += 2  // Substantial content

  return Math.min(10, score)  // Max 10 points
}

/**
 * Content Relevance Score (0-15)
 * Rewards tech/business news, penalizes product reviews and listicles
 */
function getContentRelevanceScore(feed: any): number {
  const title = feed.title.toLowerCase()
  const summary = (feed.summary || '').toLowerCase()
  const content = (feed.content || '').toLowerCase()
  const combined = `${title} ${summary} ${content}`

  let score = 5  // Base score

  // HIGH VALUE: Tech news keywords (+10 points)
  const techNewsKeywords = [
    'acquisition', 'merger', 'funding', 'raises', 'valuation',
    'launches', 'announces', 'unveils', 'releases', 'introduces',
    'partnership', 'collaboration', 'deal', 'investment',
    'ai', 'artificial intelligence', 'machine learning', 'llm',
    'startup', 'ipo', 'acquisition', 'breakthrough',
    'research', 'study', 'report', 'analysis',
    'ceo', 'founder', 'executive', 'leadership'
  ]

  const hasHighValueKeywords = techNewsKeywords.some(keyword => combined.includes(keyword))
  if (hasHighValueKeywords) score += 10

  // MEDIUM VALUE: Industry/company names (+5 points)
  const companyKeywords = [
    'apple', 'google', 'microsoft', 'amazon', 'meta', 'facebook',
    'tesla', 'spacex', 'openai', 'anthropic', 'nvidia',
    'intel', 'amd', 'qualcomm', 'samsung', 'sony'
  ]

  const mentionsCompany = companyKeywords.some(keyword => combined.includes(keyword))
  if (mentionsCompany) score += 5

  // PENALTY: Product reviews & listicles (-15 points)
  const productReviewIndicators = [
    'best ', 'top ', ' review', 'buying guide', 'to buy',
    'tested', 'comparison', 'vs ', 'versus',
    'discount', 'sale', 'coupon', 'promo'
  ]

  const isProductReview = productReviewIndicators.some(indicator =>
    title.includes(indicator) || summary.includes(indicator)
  )
  if (isProductReview) score -= 15

  // PENALTY: Listicles (-10 points)
  const listPattern = /^\d+\s+(best|top|ways|reasons|tips|things)/i
  if (listPattern.test(title)) score -= 10

  // BONUS: Timely content (+3 points)
  const timelyKeywords = ['breaking', 'just', 'today', 'now', 'latest', 'new']
  const hasTimeliness = timelyKeywords.some(keyword => title.includes(keyword))
  if (hasTimeliness) score += 3

  return Math.max(0, Math.min(15, score))  // Clamp to 0-15
}

function extractDomain(url: string): string {
  try {
    const parsed = new URL(url)
    let hostname = parsed.hostname
      .replace('www.', '')
      .replace('feeds.', '')
      .replace('blog.', '')
      .replace('news.', '')

    // Extract main domain (e.g., techcrunch.com from xyz.techcrunch.com)
    const parts = hostname.split('.')
    if (parts.length >= 2) {
      hostname = parts.slice(-2).join('.')
    }

    return hostname
  } catch {
    return ''
  }
}
