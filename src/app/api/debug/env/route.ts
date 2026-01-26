import { NextResponse } from "next/server"

/**
 * Debug endpoint to check environment configuration
 * DO NOT expose sensitive values, only check if they exist
 *
 * Remove this endpoint after debugging!
 */
export async function GET() {
  const envCheck = {
    nextauth: {
      url: !!process.env.NEXTAUTH_URL,
      urlValue: process.env.NEXTAUTH_URL ? "SET" : "MISSING",
      secret: !!process.env.NEXTAUTH_SECRET,
    },
    google: {
      clientId: !!process.env.GOOGLE_CLIENT_ID,
      clientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
    },
    database: {
      url: !!process.env.DATABASE_URL,
      type: process.env.DATABASE_URL?.includes("neon") ? "Neon" :
            process.env.DATABASE_URL?.includes("postgres") ? "PostgreSQL" : "Unknown"
    },
    redis: {
      url: !!process.env.REDIS_URL,
      type: process.env.REDIS_URL?.includes("upstash") ? "Upstash" :
            process.env.REDIS_URL?.includes("redis") ? "Redis" : "Unknown"
    },
    encryption: {
      key: !!process.env.ENCRYPTION_KEY,
    },
    nodeEnv: process.env.NODE_ENV,
    vercelEnv: process.env.VERCEL_ENV,
  }

  return NextResponse.json(envCheck)
}
