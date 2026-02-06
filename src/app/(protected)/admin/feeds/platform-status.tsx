"use client"

import { Activity, Bot, Cpu, Layers, Zap } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useAdminPlatformStatus } from "@/hooks/use-queries"

function UsageBar({ used, limit, className }: { used: number; limit: number; className?: string }) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0
  const color = pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-yellow-500" : "bg-green-500"
  return (
    <div className={`h-1.5 w-full rounded-full bg-muted ${className}`}>
      <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

export function PlatformStatus() {
  const { data, isLoading } = useAdminPlatformStatus()

  if (isLoading || !data) {
    return (
      <div className="grid gap-4 md:grid-cols-2">
        {[1, 2].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  const { queue, generatedPosts, models } = data

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Queue Status */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Queue Status</CardTitle>
          <Layers className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Queued</span>
                <span className="text-sm font-semibold">{queue.queued}</span>
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Processing</span>
                <span className="text-sm font-semibold">{queue.processing}</span>
              </div>
            </div>
          </div>

          {/* Generated Posts */}
          <div className="border-t pt-2">
            <div className="text-xs font-medium text-muted-foreground mb-1.5">Generated Posts</div>
            <div className="flex flex-wrap gap-1.5">
              {generatedPosts.PENDING > 0 && (
                <Badge variant="outline" className="text-xs">
                  Pending: {generatedPosts.PENDING}
                </Badge>
              )}
              {generatedPosts.GENERATING > 0 && (
                <Badge variant="outline" className="text-xs border-blue-400 text-blue-600">
                  <Activity className="mr-1 h-3 w-3 animate-pulse" />
                  Generating: {generatedPosts.GENERATING}
                </Badge>
              )}
              {generatedPosts.COMPLETED > 0 && (
                <Badge variant="outline" className="text-xs border-green-400 text-green-600">
                  Completed: {generatedPosts.COMPLETED}
                </Badge>
              )}
              {generatedPosts.DISTRIBUTED > 0 && (
                <Badge variant="outline" className="text-xs border-green-400 text-green-600">
                  Distributed: {generatedPosts.DISTRIBUTED}
                </Badge>
              )}
              {generatedPosts.FAILED > 0 && (
                <Badge variant="destructive" className="text-xs">
                  Failed: {generatedPosts.FAILED}
                </Badge>
              )}
              {Object.values(generatedPosts).every((v) => v === 0) && (
                <span className="text-xs text-muted-foreground">No posts in pipeline</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* GROQ API Usage */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">GROQ API Usage (Today)</CardTitle>
          <Zap className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent className="space-y-3">
          {models.map((model) => (
            <div key={model.id} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  {model.purpose === "Content Moderation" ? (
                    <Bot className="h-3.5 w-3.5 text-muted-foreground" />
                  ) : (
                    <Cpu className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                  <span className="text-xs font-medium">{model.label}</span>
                  <span className="text-[10px] text-muted-foreground">({model.purpose})</span>
                </div>
                <div className="flex items-center gap-1">
                  <Badge
                    variant={model.availableKeys > 0 ? "outline" : "destructive"}
                    className="text-[10px] px-1 py-0"
                  >
                    {model.availableKeys}/{model.totalKeys} keys
                  </Badge>
                </div>
              </div>

              {/* Requests */}
              <div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">Requests</span>
                  <span>
                    {formatNumber(model.requests.today)} / {formatNumber(model.requests.dailyLimit)}
                    <span className="text-muted-foreground ml-1">
                      ({formatNumber(model.requests.remaining)} left)
                    </span>
                  </span>
                </div>
                <UsageBar used={model.requests.today} limit={model.requests.dailyLimit} />
              </div>

              {/* Tokens */}
              <div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground">Tokens</span>
                  <span>
                    {formatNumber(model.tokens.today)} / {formatNumber(model.tokens.dailyLimit)}
                    <span className="text-muted-foreground ml-1">
                      ({formatNumber(model.tokens.remaining)} left)
                    </span>
                  </span>
                </div>
                <UsageBar used={model.tokens.today} limit={model.tokens.dailyLimit} />
              </div>

              {model.id !== models[models.length - 1].id && <div className="border-t" />}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
