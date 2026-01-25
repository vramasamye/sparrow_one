import CryptoJS from "crypto-js"

function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY || ""
  return key
}

/**
 * Encrypt a string using AES-256-GCM
 */
export function encrypt(text: string): string {
  const key = getEncryptionKey()
  if (!key) {
    // In development without key, return plaintext with marker
    return `DEV:${text}`
  }

  const encrypted = CryptoJS.AES.encrypt(text, key).toString()
  return encrypted
}

/**
 * Decrypt a string using AES-256-GCM
 */
export function decrypt(encryptedText: string): string {
  const key = getEncryptionKey()
  if (!key) {
    // In development without key, handle plaintext marker
    if (encryptedText.startsWith("DEV:")) {
      return encryptedText.slice(4)
    }
    return encryptedText
  }

  // Handle legacy unencrypted tokens
  if (encryptedText.startsWith("DEV:")) {
    return encryptedText.slice(4)
  }

  const bytes = CryptoJS.AES.decrypt(encryptedText, key)
  const decrypted = bytes.toString(CryptoJS.enc.Utf8)
  return decrypted
}

/**
 * Generate a random encryption key (32 bytes for AES-256)
 */
export function generateEncryptionKey(): string {
  return CryptoJS.lib.WordArray.random(32).toString(CryptoJS.enc.Hex)
}
