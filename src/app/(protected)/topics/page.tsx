"use client"

import { useState } from "react"
import { Check, Loader2, Rss, Tags } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useTopics, useToggleTopic } from "@/hooks/use-queries"

const topicColors = [
  { bg: "bg-amber-50", border: "border-amber-200", accent: "bg-amber-500", ring: "ring-amber-200" },
  { bg: "bg-sky-50", border: "border-sky-200", accent: "bg-sky-500", ring: "ring-sky-200" },
  { bg: "bg-emerald-50", border: "border-emerald-200", accent: "bg-emerald-500", ring: "ring-emerald-200" },
  { bg: "bg-purple-50", border: "border-purple-200", accent: "bg-purple-500", ring: "ring-purple-200" },
  { bg: "bg-rose-50", border: "border-rose-200", accent: "bg-rose-500", ring: "ring-rose-200" },
  { bg: "bg-indigo-50", border: "border-indigo-200", accent: "bg-indigo-500", ring: "ring-indigo-200" },
  { bg: "bg-orange-50", border: "border-orange-200", accent: "bg-orange-500", ring: "ring-orange-200" },
  { bg: "bg-teal-50", border: "border-teal-200", accent: "bg-teal-500", ring: "ring-teal-200" },
  { bg: "bg-pink-50", border: "border-pink-200", accent: "bg-pink-500", ring: "ring-pink-200" },
  { bg: "bg-cyan-50", border: "border-cyan-200", accent: "bg-cyan-500", ring: "ring-cyan-200" },
]

export default function TopicsPage() {
  const { data: topics = [], isLoading } = useTopics()
  const toggleTopicMutation = useToggleTopic()
  const [togglingId, setTogglingId] = useState<string | null>(null)

  const handleToggle = async (topicId: string, isFollowing: boolean) => {
    setTogglingId(topicId)
    await toggleTopicMutation.mutateAsync({ topicId, isFollowing })
    setTogglingId(null)
  }

  const followingCount = topics.filter((t) => t.isFollowing).length

  if (isLoading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-2 h-7 w-48" />
          <Skeleton className="mt-1 h-4 w-64" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-36 rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-amber-600 text-xs font-medium tracking-wide uppercase">
            <Tags className="h-3.5 w-3.5" />
            Content Topics
          </div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">Topics</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Select topics to receive curated content from
          </p>
        </div>
        <Badge
          variant="secondary"
          className="w-fit rounded-full px-3 py-1 text-xs font-semibold"
        >
          {followingCount} selected
        </Badge>
      </div>

      {/* Topics Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {topics.map((topic, index) => {
          const color = topicColors[index % topicColors.length]
          const isToggling = toggleTopicMutation.isPending && togglingId === topic.id

          return (
            <button
              key={topic.id}
              onClick={() => handleToggle(topic.id, topic.isFollowing)}
              disabled={isToggling}
              className={`group relative flex flex-col rounded-2xl border p-5 text-left transition-all
                ${topic.isFollowing
                  ? `${color.border} ${color.bg} ring-1 ${color.ring} shadow-sm`
                  : "border-border bg-card hover:border-muted-foreground/20 hover:shadow-md"
                }
                ${isToggling ? "opacity-70" : ""}
              `}
            >
              {/* Follow indicator */}
              <div className="flex items-start justify-between">
                <div className={`flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
                  topic.isFollowing
                    ? `${color.accent} text-white`
                    : "bg-muted text-muted-foreground group-hover:bg-muted/80"
                }`}>
                  {isToggling ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : topic.isFollowing ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    <Tags className="h-3.5 w-3.5" />
                  )}
                </div>
                {topic.isFollowing && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-600">
                    Following
                  </span>
                )}
              </div>

              {/* Content */}
              <h3 className="mt-3 text-sm font-semibold leading-tight">{topic.name}</h3>
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground leading-relaxed">
                {topic.description}
              </p>

              {/* Footer */}
              <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Rss className="h-3 w-3" />
                <span>{topic._count.rssFeeds} feeds</span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
