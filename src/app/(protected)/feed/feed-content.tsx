"use client"

import { useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { formatDistanceToNow } from "date-fns"
import { ExternalLink, Loader2, Sparkles, CheckCircle, Clock } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"

interface ScheduledPost {
  id: string
  platform: "TWITTER" | "LINKEDIN"
  scheduledFor: string
  status: "SCHEDULED" | "PUBLISHING" | "PUBLISHED"
}

interface FeedItem {
  id: string
  title: string
  url: string
  summary: string | null
  imageUrl: string | null
  author: string | null
  publishedAt: string | null
  topic: {
    name: string
    slug: string
  }
  rssFeed: {
    name: string
  }
  scheduledPosts: ScheduledPost[]
}

export function FeedContent() {
  const searchParams = useSearchParams()
  const [feeds, setFeeds] = useState<FeedItem[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(1)

  const topicId = searchParams.get("topic")

  useEffect(() => {
    setFeeds([])
    setPage(1)
    setHasMore(true)
    fetchFeeds(1, true)
  }, [topicId])

  async function fetchFeeds(pageNum: number, reset = false) {
    if (reset) {
      setLoading(true)
    } else {
      setLoadingMore(true)
    }

    try {
      const params = new URLSearchParams({
        page: pageNum.toString(),
        limit: "12",
      })
      if (topicId) {
        params.set("topic", topicId)
      }

      const response = await fetch(`/api/user/feeds?${params.toString()}`)
      if (!response.ok) throw new Error("Failed to fetch feeds")

      const data = await response.json()

      if (reset) {
        setFeeds(data.feeds)
      } else {
        setFeeds((prev) => [...prev, ...data.feeds])
      }

      setHasMore(data.hasMore)
      setPage(pageNum)
    } catch {
      toast.error("Failed to load content")
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-64" />
        ))}
      </div>
    )
  }

  if (feeds.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <Sparkles className="mx-auto h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold">No content available</h3>
        <p className="mt-2 text-muted-foreground">
          {topicId
            ? "No approved content for this topic yet."
            : "Select some topics to see relevant content."}
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {feeds.map((feed) => (
          <Card key={feed.id} className="flex flex-col">
            {feed.imageUrl && (
              <div className="aspect-video overflow-hidden rounded-t-lg">
                <img
                  src={feed.imageUrl}
                  alt={feed.title}
                  className="h-full w-full object-cover"
                />
              </div>
            )}
            <CardHeader className="flex-1 pb-3">
              <div className="flex items-start justify-between gap-2">
                <Badge variant="secondary" className="shrink-0">
                  {feed.topic.name}
                </Badge>
              </div>
              <CardTitle className="line-clamp-2 text-base">{feed.title}</CardTitle>
              <CardDescription className="line-clamp-2">
                {feed.summary || "No summary available"}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{feed.rssFeed.name}</span>
                {feed.publishedAt && (
                  <span>
                    {formatDistanceToNow(new Date(feed.publishedAt), { addSuffix: true })}
                  </span>
                )}
              </div>
              <div className="mt-4 flex gap-2">
                {feed.scheduledPosts && feed.scheduledPosts.length > 0 ? (
                  <div className="flex flex-1 flex-col gap-1">
                    {feed.scheduledPosts.map((post) => (
                      <div
                        key={post.id}
                        className="flex items-center gap-2 rounded-md bg-green-50 px-3 py-1.5 text-xs text-green-700 dark:bg-green-950/20 dark:text-green-400"
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                        <span className="font-medium">
                          {post.platform === "TWITTER" ? "Twitter" : "LinkedIn"}
                        </span>
                        <span className="text-muted-foreground">·</span>
                        <span>
                          {post.status === "PUBLISHED"
                            ? "Published"
                            : formatDistanceToNow(new Date(post.scheduledFor), {
                                addSuffix: true,
                              })}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-1 items-center gap-2 rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-700 dark:bg-blue-950/20 dark:text-blue-400">
                    <Clock className="h-3.5 w-3.5 animate-pulse" />
                    <span>Being scheduled for you...</span>
                  </div>
                )}
                <Button variant="outline" size="sm" asChild>
                  <a href={feed.url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {hasMore && (
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            onClick={() => fetchFeeds(page + 1)}
            disabled={loadingMore}
          >
            {loadingMore ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Loading...
              </>
            ) : (
              "Load More"
            )}
          </Button>
        </div>
      )}
    </>
  )
}
