import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { redis } from "@/lib/redis"

export async function GET() {
  const health: any = {
    status: "ok",
    timestamp: new Date().toISOString(),
    services: {
      database: "unknown",
      redis: "unknown",
    }
  }

  try {
    // Check Database
    await prisma.$queryRaw`SELECT 1`
    health.services.database = "healthy"
  } catch (error) {
    health.status = "error"
    health.services.database = "unhealthy"
    health.error = error instanceof Error ? error.message : "Database connection failed"
  }

  try {
    // Check Redis
    await redis.ping()
    health.services.redis = "healthy"
  } catch (error) {
    health.status = "error"
    health.services.redis = "unhealthy"
    health.redisError = error instanceof Error ? error.message : "Redis connection failed"
  }

  const status = health.status === "ok" ? 200 : 503
  return NextResponse.json(health, { status })
}
