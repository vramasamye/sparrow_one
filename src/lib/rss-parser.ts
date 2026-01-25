import Parser from "rss-parser"

import { generateFeedItemHash } from "./hash"

export interface ParsedFeedItem {
  title: string
  url: string
  contentHash: string
  summary: string | null
  content: string | null
  imageUrl: string | null
  author: string | null
  publishedAt: Date | null
}

const parser = new Parser({
  timeout: 10000, // 10 second timeout
  headers: {
    "User-Agent": "Sparrow RSS Reader/1.0",
    Accept: "application/rss+xml, application/xml, text/xml, */*",
  },
  customFields: {
    item: [
      ["media:content", "mediaContent"],
      ["media:thumbnail", "mediaThumbnail"],
      ["enclosure", "enclosure"],
      ["content:encoded", "contentEncoded"],
    ],
  },
})

/**
 * Parse an RSS feed URL and extract items
 */
export async function parseFeed(feedUrl: string): Promise<ParsedFeedItem[]> {
  try {
    const feed = await parser.parseURL(feedUrl)
    const items: ParsedFeedItem[] = []

    for (const item of feed.items || []) {
      if (!item.title || !item.link) {
        continue
      }

      // Cast item to include custom fields
      const extendedItem = item as typeof item & {
        mediaContent?: unknown
        mediaThumbnail?: unknown
        contentEncoded?: string
        author?: string
      }

      // Generate content hash for deduplication
      const contentHash = generateFeedItemHash(item.link, item.title)

      // Extract image URL from various possible locations
      const imageUrl = extractImageUrl(extendedItem)

      // Extract content from various possible locations
      const content = extractContent(extendedItem)
      const summary = extractSummary(item, content)

      // Parse published date
      const publishedAt = item.pubDate || item.isoDate ? new Date(item.pubDate || item.isoDate!) : null

      items.push({
        title: sanitizeText(item.title),
        url: item.link,
        contentHash,
        summary: summary ? sanitizeText(summary) : null,
        content: content ? sanitizeHtml(content) : null,
        imageUrl,
        author: item.creator || extendedItem.author || null,
        publishedAt: publishedAt && !isNaN(publishedAt.getTime()) ? publishedAt : null,
      })
    }

    return items
  } catch (error) {
    console.error(`Failed to parse feed ${feedUrl}:`, error)
    throw error
  }
}

interface ExtendedItem extends Parser.Item {
  mediaContent?: unknown
  mediaThumbnail?: unknown
  contentEncoded?: string
  author?: string
}

/**
 * Extract image URL from various RSS item fields
 */
function extractImageUrl(item: ExtendedItem): string | null {
  // Check media:content
  if (item.mediaContent && typeof item.mediaContent === "object") {
    const media = item.mediaContent as Record<string, unknown>
    if (media.$ && typeof media.$ === "object") {
      const attrs = media.$ as Record<string, string>
      if (attrs.url) return attrs.url
    }
  }

  // Check media:thumbnail
  if (item.mediaThumbnail && typeof item.mediaThumbnail === "object") {
    const thumb = item.mediaThumbnail as Record<string, unknown>
    if (thumb.$ && typeof thumb.$ === "object") {
      const attrs = thumb.$ as Record<string, string>
      if (attrs.url) return attrs.url
    }
  }

  // Check enclosure
  if (item.enclosure && typeof item.enclosure === "object") {
    const enclosure = item.enclosure as { url?: string; type?: string }
    if (enclosure.url && enclosure.type?.startsWith("image/")) {
      return enclosure.url
    }
  }

  // Try to extract from content
  const content = (item.contentEncoded as string) || item.content || ""
  const imgMatch = content.match(/<img[^>]+src=["']([^"']+)["']/i)
  if (imgMatch) {
    return imgMatch[1]
  }

  return null
}

/**
 * Extract content from various RSS item fields
 */
function extractContent(item: ExtendedItem): string | null {
  // Prefer content:encoded for full content
  if (item.contentEncoded && typeof item.contentEncoded === "string") {
    return item.contentEncoded
  }

  // Fall back to content
  if (item.content && typeof item.content === "string") {
    return item.content
  }

  return null
}

/**
 * Extract summary, limiting length
 */
function extractSummary(item: Parser.Item, content: string | null): string | null {
  // Use contentSnippet if available (already stripped of HTML)
  if (item.contentSnippet) {
    return item.contentSnippet.substring(0, 500)
  }

  // Use summary/description
  if (item.summary) {
    return stripHtml(item.summary).substring(0, 500)
  }

  // Extract from content
  if (content) {
    return stripHtml(content).substring(0, 500)
  }

  return null
}

/**
 * Strip HTML tags from text
 */
function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Sanitize text by removing control characters
 */
function sanitizeText(text: string): string {
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

/**
 * Basic HTML sanitization - remove scripts and dangerous attributes
 */
function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/on\w+="[^"]*"/gi, "")
    .replace(/on\w+='[^']*'/gi, "")
}
