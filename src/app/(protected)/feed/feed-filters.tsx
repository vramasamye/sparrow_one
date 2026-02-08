"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useMemo } from "react"
import { Tags } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useTopics } from "@/hooks/use-queries"

export function FeedFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: allTopics = [], isLoading: loading } = useTopics()

  const currentTopic = searchParams.get("topic")

  // Filter to only show following topics
  const topics = useMemo(
    () => allTopics.filter((t) => t.isFollowing),
    [allTopics]
  )

  function handleTopicChange(topicId: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (topicId) {
      params.set("topic", topicId)
    } else {
      params.delete("topic")
    }
    router.push(`/feed?${params.toString()}`)
  }

  if (loading) {
    return (
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-8 w-20 rounded-full" />
        ))}
      </div>
    )
  }

  if (topics.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/50 px-5 py-4">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/10">
          <Tags className="h-4 w-4 text-amber-600" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium">No topics selected</p>
          <p className="text-xs text-muted-foreground">Follow topics to see curated content here</p>
        </div>
        <Button size="sm" className="bg-amber-600 hover:bg-amber-700 text-white" onClick={() => router.push("/topics")}>
          Choose Topics
        </Button>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      <button
        onClick={() => handleTopicChange(null)}
        className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
          !currentTopic
            ? "bg-foreground text-background shadow-sm"
            : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
        }`}
      >
        All
      </button>
      {topics.map((topic) => (
        <button
          key={topic.id}
          onClick={() => handleTopicChange(topic.id)}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all ${
            currentTopic === topic.id
              ? "bg-foreground text-background shadow-sm"
              : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
          }`}
        >
          {topic.name}
        </button>
      ))}
    </div>
  )
}
