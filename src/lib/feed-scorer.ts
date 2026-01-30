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

/**
 * Source authority scores (whitelist)
 */
const SOURCE_AUTHORITY: Record<string, number> = {
  // Tier 1: Tech Giants (20 points)
  'techcrunch.com': 20,
  'theverge.com': 20,
  'arstechnica.com': 20,
  'wired.com': 20,

  // Tier 2: Official Company Blogs (18 points)
  'openai.com': 18,
  'vercel.com': 18,
  'blog.google': 18,
  'engineering.fb.com': 18,
  'aws.amazon.com': 18,
  'github.blog': 18,

  // Tier 3: Popular Dev Blogs (15 points)
  'dev.to': 15,
  'medium.com': 15,
  'hackernoon.com': 15,
  'smashingmagazine.com': 15,

  // Tier 4: Individual Blogs (10 points) - default
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
  // PHASE 1: RULE-BASED SCORING (0-50)
  // ========================================

  // 1. Source Authority (0-20)
  const sourceScore = getSourceAuthorityScore(feed.rssFeed.url, feed.rssFeed.authorityScore)

  // 2. Recency (0-15)
  const recencyScore = getRecencyScore(feed.publishedAt)

  // 3. Metadata Quality (0-15)
  const metadataScore = getMetadataScore(feed)

  const ruleBasedScore = sourceScore + recencyScore + metadataScore

  // ========================================
  // PHASE 2: LLAMA GUARD MODERATION
  // ========================================

  console.log(`📝 Moderating: "${feed.title.substring(0, 60)}..."`)

  const moderation = await moderateContentSafe(
    feed.title,
    feed.summary,
    feed.content
  )

  // Calculate moderation boost/penalty
  let moderationBoost = 0

  if (!moderation.isSafe) {
    // Heavy penalty for unsafe content
    moderationBoost = -50
  } else {
    // Small boost for high-confidence safe content
    moderationBoost = Math.round((moderation.confidence - 0.5) * 20)
  }

  // ========================================
  // PHASE 3: FINAL SCORE & DECISION
  // ========================================

  const qualityScore = Math.max(0, Math.min(100, ruleBasedScore + moderationBoost))

  // Auto-rejection rules (STRICT)
  const autoReject =
    !moderation.isSafe ||
    moderation.flags.isSalesContent ||
    moderation.flags.hasPromoCodes ||
    moderation.flags.isClickbait ||
    moderation.flags.isSpam ||
    qualityScore < 60

  // Auto-approval rules (high quality, no red flags)
  const autoApprove =
    moderation.isSafe &&
    !moderation.flags.isSalesContent &&
    !moderation.flags.hasPromoCodes &&
    !moderation.flags.isClickbait &&
    !moderation.flags.isSpam &&
    qualityScore >= 80

  // Generate reasoning
  let reasoning = moderation.reasoning

  if (autoReject) {
    const reasons = []
    if (!moderation.isSafe) reasons.push(`Unsafe content (${moderation.category})`)
    if (moderation.flags.isSalesContent) reasons.push('Sales/promotional content')
    if (moderation.flags.hasPromoCodes) reasons.push('Contains promo codes')
    if (moderation.flags.isClickbait) reasons.push('Clickbait detected')
    if (moderation.flags.isSpam) reasons.push('Spam detected')
    if (qualityScore < 60) reasons.push(`Low quality score (${qualityScore})`)
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

  if (feed.imageUrl) score += 5                              // Has featured image
  if (feed.author) score += 3                                // Has author
  if (feed.summary && feed.summary.length > 100) score += 4  // Good summary
  if (feed.content && feed.content.length > 500) score += 3  // Substantial content

  return score
}

function extractDomain(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.hostname.replace('www.', '')
  } catch {
    return ''
  }
}
