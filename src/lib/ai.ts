import { generateText } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { getAvailableKey, recordUsage, waitForAvailableKey } from "@/lib/rate-limiter"

// OpenRouter as fallback
const openrouter = createOpenAI({
  apiKey: process.env.OPENROUTER_API_KEY || "",
  baseURL: "https://openrouter.ai/api/v1",
})

export type Platform = "twitter" | "linkedin"

interface GeneratePostOptions {
  title: string
  summary: string | null
  url: string
  platform: Platform
  /**
   * Whether to wait for rate limits to reset (for background tasks)
   * If true, will wait up to 10 minutes for a key to become available
   * If false (default), will fail immediately if all keys are rate limited
   */
  waitForRateLimit?: boolean
}

const TWITTER_SYSTEM_PROMPT = `You are a social media expert who creates engaging tweets. Your task is to transform article information into compelling tweets.

Rules:
- Maximum 280 characters (leave room for the URL)
- Use engaging hooks to capture attention
- Include 1-2 relevant hashtags
- Keep it conversational and authentic
- Do NOT include the URL in your response (it will be added automatically)
- Focus on the key insight or takeaway
- Use emojis sparingly and appropriately

Output format: Just the tweet text, nothing else.`

const LINKEDIN_SYSTEM_PROMPT = `You are a professional content creator who crafts engaging LinkedIn posts. Your task is to transform article information into professional yet engaging LinkedIn posts.

Rules:
- 150-300 words recommended
- Start with a strong hook (question, statistic, or bold statement)
- Break content into short paragraphs for readability
- Include a call-to-action or thought-provoking question at the end
- Use 3-5 relevant hashtags at the end
- Maintain professional tone while being personable
- Do NOT include the article URL in your response (it will be added automatically)
- Add relevant emojis to enhance visual appeal

Output format: Just the post text, nothing else.`

// Primary model to use
const GROQ_MODEL = "moonshotai/kimi-k2-instruct"

export async function generatePost({ title, summary, url, platform, waitForRateLimit = false }: GeneratePostOptions): Promise<string> {
  const systemPrompt = platform === "twitter" ? TWITTER_SYSTEM_PROMPT : LINKEDIN_SYSTEM_PROMPT

  const userPrompt = `Create a ${platform === "twitter" ? "tweet" : "LinkedIn post"} for this article:

Title: ${title}
${summary ? `Summary: ${summary}` : ""}
URL: ${url}

Generate the ${platform === "twitter" ? "tweet" : "post"} content:`

  try {
    // 1. Get an available API key for the model
    let apiKey: string | null

    if (waitForRateLimit) {
      // For background tasks: wait up to 10 minutes for a key to become available
      console.log("⏳ Waiting for available GROQ API key...")
      apiKey = await waitForAvailableKey(GROQ_MODEL, 10, 30) // 10 min max, check every 30s
    } else {
      // For interactive requests: fail immediately if no key available
      apiKey = await getAvailableKey(GROQ_MODEL)
    }

    if (!apiKey) {
      throw new Error("Rate limit exceeded for all available Groq API keys.")
    }

    // 2. Create a temporary provider instance
    const groq = createOpenAI({
      apiKey: apiKey,
      baseURL: "https://api.groq.com/openai/v1",
    })

    // 3. Generate text
    const result = await generateText({
      model: groq(GROQ_MODEL),
      system: systemPrompt,
      prompt: userPrompt,
    })

    // 4. Record usage
    const totalTokens = result.usage?.totalTokens ?? 0
    await recordUsage(apiKey, GROQ_MODEL, totalTokens)

    let content = result.text.trim()

    // Add URL for Twitter
    if (platform === "twitter") {
      const urlLength = 23 // Twitter's t.co shortened URL length
      const maxContentLength = 280 - urlLength - 2 // -2 for space and buffer
      if (content.length > maxContentLength) {
        content = content.substring(0, maxContentLength - 3) + "..."
      }
      content = `${content}\n\n${url}`
    } else {
      // Add URL for LinkedIn
      content = `${content}\n\n🔗 Read more: ${url}`
    }

    return content
  } catch (error) {
    console.error("Groq API error, trying OpenRouter:", error)

    // Fallback to OpenRouter
    try {
      const result = await generateText({
        model: openrouter("meta-llama/llama-3.1-70b-instruct"),
        system: systemPrompt,
        prompt: userPrompt,
      })

      let content = result.text.trim()

      if (platform === "twitter") {
        const urlLength = 23
        const maxContentLength = 280 - urlLength - 2
        if (content.length > maxContentLength) {
          content = content.substring(0, maxContentLength - 3) + "..."
        }
        content = `${content}\n\n${url}`
      } else {
        content = `${content}\n\n🔗 Read more: ${url}`
      }

      return content
    } catch (fallbackError) {
      console.error("OpenRouter API error:", fallbackError)
      throw new Error("Failed to generate content with both AI providers")
    }
  }
}
