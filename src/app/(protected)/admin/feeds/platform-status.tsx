"use client"

import { Activity, Bot, Cpu, Layers, Zap } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useAdminPlatformStatus } from "@/hooks/use-queries"

function UsageBar({ used, limit }: { used: number; limit: number }) {
  const pct = limit > 0 ? Math.min(100, (used / limit) * 100) : 0
  const color =
    pct >= 90
      ? "bg-red-500"
      : pct >= 70
        ? "bg-amber-500"
        : "bg-emerald-500"
  return (
    <div className="h-1 w-full rounded-full bg-muted">
      <div
        className={`h-1 rounded-full transition-all ${color}`}
        style={{ width: `${pct}%` }}
      />
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
      <div className="flex gap-3 lg:w-[420px]">
        {[1, 2].map((i) => (
          <div key={i} className="flex-1 rounded-xl border bg-card p-4">
            <Skeleton className="h-3 w-20 mb-3" />
            <Skeleton className="h-12 w-full" />
          </div>
        ))}
      </div>
    )
  }

  const { queue, generatedPosts, models } = data

  return (
    <div className="flex flex-col gap-3 sm:flex-row lg:w-[420px]">
      {/* Queue */}
      <div className="flex-1 rounded-xl border bg-card p-4">
        <div className="flex items-center gap-1.5">
          <Layers className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Queue</span>
        </div>

        <div className="mt-3 flex gap-4">
          <div>
            <div className="text-lg font-bold">{queue.queued}</div>
            <div className="text-[10px] text-muted-foreground">Queued</div>
          </div>
          <div>
            <div className="text-lg font-bold">{queue.processing}</div>
            <div className="text-[10px] text-muted-foreground">Processing</div>
          </div>
        </div>

        <div className="mt-3 border-t pt-2">
          <div className="flex flex-wrap gap-1">
            {generatedPosts.GENERATING > 0 && (
              <Badge variant="outline" className="h-5 gap-1 border-blue-300 px-1.5 text-[10px] text-blue-600">
                <Activity className="h-2.5 w-2.5 animate-pulse" />
                {generatedPosts.GENERATING}
              </Badge>
            )}
            {generatedPosts.COMPLETED > 0 && (
              <Badge variant="outline" className="h-5 border-emerald-300 px-1.5 text-[10px] text-emerald-600">
                Done: {generatedPosts.COMPLETED}
              </Badge>
            )}
            {generatedPosts.DISTRIBUTED > 0 && (
              <Badge variant="outline" className="h-5 border-emerald-300 px-1.5 text-[10px] text-emerald-600">
                Dist: {generatedPosts.DISTRIBUTED}
              </Badge>
            )}
            {generatedPosts.FAILED > 0 && (
              <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">
                Fail: {generatedPosts.FAILED}
              </Badge>
            )}
            {generatedPosts.PENDING > 0 && (
              <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                Pend: {generatedPosts.PENDING}
              </Badge>
            )}
            {Object.values(generatedPosts).every((v) => v === 0) && (
              <span className="text-[10px] text-muted-foreground">Empty pipeline</span>
            )}
          </div>
        </div>
      </div>

      {/* API Usage */}
      <div className="flex-1 rounded-xl border bg-card p-4">
        <div className="flex items-center gap-1.5">
          <Zap className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">API Usage</span>
        </div>

        <div className="mt-3 space-y-3">
          {models.map((model, i) => (
            <div key={model.id} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1">
                  {model.purpose === "Content Scoring" ? (
                    <Bot className="h-3 w-3 text-muted-foreground" />
                  ) : (
                    <Cpu className="h-3 w-3 text-muted-foreground" />
                  )}
                  <span className="text-[11px] font-medium">{model.label}</span>
                </div>
                <Badge
                  variant={model.availableKeys > 0 ? "outline" : "destructive"}
                  className="h-4 px-1 text-[9px]"
                >
                  {model.availableKeys}/{model.totalKeys}
                </Badge>
              </div>

              <div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Requests</span>
                  <span className="font-mono">
                    {formatNumber(model.requests.today)}/{formatNumber(model.requests.dailyLimit)}
                  </span>
                </div>
                <UsageBar used={model.requests.today} limit={model.requests.dailyLimit} />
              </div>

              <div>
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Tokens</span>
                  <span className="font-mono">
                    {formatNumber(model.tokens.today)}/{formatNumber(model.tokens.dailyLimit)}
                  </span>
                </div>
                <UsageBar used={model.tokens.today} limit={model.tokens.dailyLimit} />
              </div>

              {i < models.length - 1 && <div className="border-t pt-1" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
