"use client"

import { useEffect, useState, useTransition } from "react"
import { Check, Loader2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"

interface Topic {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  _count: {
    rssFeeds: number
  }
  isFollowing: boolean
}

export default function TopicsPage() {
  const [topics, setTopics] = useState<Topic[]>([])
  const [loading, setLoading] = useState(true)
  const [pending, startTransition] = useTransition()
  const [togglingId, setTogglingId] = useState<string | null>(null)

  useEffect(() => {
    fetchTopics()
  }, [])

  async function fetchTopics() {
    try {
      const response = await fetch("/api/topics")
      if (!response.ok) throw new Error("Failed to fetch topics")
      const data = await response.json()
      setTopics(data)
    } catch {
      toast.error("Failed to load topics")
    } finally {
      setLoading(false)
    }
  }

  async function toggleTopic(topicId: string, isFollowing: boolean) {
    setTogglingId(topicId)
    startTransition(async () => {
      try {
        const response = await fetch(`/api/topics/${topicId}/follow`, {
          method: isFollowing ? "DELETE" : "POST",
        })

        if (!response.ok) throw new Error("Failed to update topic")

        setTopics((prev) =>
          prev.map((t) => (t.id === topicId ? { ...t, isFollowing: !isFollowing } : t))
        )

        toast.success(isFollowing ? "Unfollowed topic" : "Following topic")
      } catch {
        toast.error("Failed to update topic")
      } finally {
        setTogglingId(null)
      }
    })
  }

  const followingCount = topics.filter((t) => t.isFollowing).length

  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Topics</h1>
          <p className="text-muted-foreground">Select topics to receive content from</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Topics</h1>
          <p className="text-muted-foreground">Select topics to receive content from</p>
        </div>
        <Badge variant="secondary" className="w-fit">
          {followingCount} topic{followingCount !== 1 ? "s" : ""} selected
        </Badge>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {topics.map((topic) => (
          <Card
            key={topic.id}
            className={`cursor-pointer transition-all hover:shadow-md ${
              topic.isFollowing ? "border-primary bg-primary/5" : ""
            }`}
            onClick={() => toggleTopic(topic.id, topic.isFollowing)}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <CardTitle className="text-lg">{topic.name}</CardTitle>
                {topic.isFollowing && (
                  <div className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-3 w-3" />
                  </div>
                )}
              </div>
              <CardDescription className="line-clamp-2">{topic.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {topic._count.rssFeeds} feeds
                </span>
                <Button
                  variant={topic.isFollowing ? "secondary" : "default"}
                  size="sm"
                  disabled={pending && togglingId === topic.id}
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleTopic(topic.id, topic.isFollowing)
                  }}
                >
                  {pending && togglingId === topic.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : topic.isFollowing ? (
                    "Unfollow"
                  ) : (
                    "Follow"
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
