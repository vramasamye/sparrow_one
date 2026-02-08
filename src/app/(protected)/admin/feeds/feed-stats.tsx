"use client"

import { CheckCircle, Clock, Rss, XCircle } from "lucide-react"

import { Skeleton } from "@/components/ui/skeleton"
import { useAdminFeedStats } from "@/hooks/use-queries"

export function FeedStats() {
  const { data: stats, isLoading } = useAdminFeedStats()

  if (isLoading || !stats) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-xl border bg-card p-4">
            <Skeleton className="h-3 w-16 mb-3" />
            <Skeleton className="h-7 w-10" />
          </div>
        ))}
      </div>
    )
  }

  const items = [
    {
      label: "Pending",
      value: stats.pending,
      icon: Clock,
      accent: "text-amber-500",
      bg: "bg-amber-500/10",
      border: "border-l-amber-400",
    },
    {
      label: "Approved",
      value: stats.approved,
      icon: CheckCircle,
      accent: "text-emerald-500",
      bg: "bg-emerald-500/10",
      border: "border-l-emerald-400",
    },
    {
      label: "Rejected",
      value: stats.rejected,
      icon: XCircle,
      accent: "text-red-400",
      bg: "bg-red-500/10",
      border: "border-l-red-400",
    },
    {
      label: "Active Feeds",
      value: stats.activeFeeds,
      icon: Rss,
      accent: "text-blue-500",
      bg: "bg-blue-500/10",
      border: "border-l-blue-400",
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className={`relative overflow-hidden rounded-xl border border-l-[3px] ${item.border} bg-card p-4 transition-shadow hover:shadow-md`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
            <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${item.bg}`}>
              <item.icon className={`h-3.5 w-3.5 ${item.accent}`} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight">{item.value}</div>
        </div>
      ))}
    </div>
  )
}
