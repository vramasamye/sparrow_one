import CryptoJS from "crypto-js"

/**
 * Generate a SHA-256 hash for content deduplication
 */
export function generateContentHash(content: string): string {
  // Normalize the content by removing extra whitespace and lowercasing
  const normalized = content.toLowerCase().replace(/\s+/g, " ").trim()
  return CryptoJS.SHA256(normalized).toString(CryptoJS.enc.Hex)
}

/**
 * Generate a hash from URL and title for quick duplicate detection
 */
export function generateFeedItemHash(url: string, title: string): string {
  const combined = `${url}|${title}`
  return CryptoJS.SHA256(combined).toString(CryptoJS.enc.Hex)
}
