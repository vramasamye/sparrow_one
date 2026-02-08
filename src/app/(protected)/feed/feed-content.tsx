"use client"

import { useSearchParams } from "next/navigation"
import { useState, useEffect } from "react"
import { formatDistanceToNow } from "date-fns"
import { ExternalLink, Loader2, Sparkles, Clock, Linkedin, Twitter } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { useUserFeeds } from "@/hooks/use-queries"

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
  const [page, setPage] = useState(1)
  const [allFeeds, setAllFeeds] = useState<FeedItem[]>([])

  const topicId = searchParams.get("topic") || undefined

  // Fetch current page
  const { data, isLoading, isFetching } = useUserFeeds(topicId, page)

  // Reset to page 1 when topic changes
  useEffect(() => {
    setPage(1)
    setAllFeeds([])
  }, [topicId])

  // Update accumulated feeds when new data arrives
  useEffect(() => {
    if (data) {
      if (page === 1) {
        setAllFeeds(data.feeds)
      } else {
        setAllFeeds((prev) => [...prev, ...data.feeds])
      }
    }
  }, [data, page])

  const feeds = allFeeds
  const hasMore = data?.hasMore ?? false
  const loadingMore = isFetching && page > 1

  if (isLoading && page === 1) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="rounded-2xl border bg-card">
            <Skeleton className="aspect-video rounded-t-2xl" />
            <div className="p-4 space-y-3">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (feeds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed py-16 px-6">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
          <Sparkles className="h-6 w-6 text-muted-foreground" />
        </div>
        <h3 className="mt-4 text-base font-semibold">No content available</h3>
        <p className="mt-1 text-sm text-muted-foreground text-center max-w-sm">
          {topicId
            ? "No approved content for this topic yet. Check back soon."
            : "Select some topics to see relevant content."}
        </p>
      </div>
    )
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {feeds.map((feed) => (
          <div
            key={feed.id}
            className="group flex flex-col overflow-hidden rounded-2xl border bg-card transition-all hover:shadow-lg hover:border-border/80"
          >
            {/* Image */}
            {feed.imageUrl ? (
              <div className="relative aspect-video overflow-hidden bg-muted">
                <img
                  src={feed.imageUrl}
                  alt={feed.title}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                <Badge className="absolute bottom-2.5 left-2.5 bg-white/90 text-foreground hover:bg-white border-0 text-[11px] font-medium backdrop-blur-sm">
                  {feed.topic.name}
                </Badge>
              </div>
            ) : (
              <div className="relative flex aspect-video items-center justify-center bg-gradient-to-br from-stone-100 to-stone-50">
                <Sparkles className="h-8 w-8 text-stone-300" />
                <Badge className="absolute bottom-2.5 left-2.5 bg-white/90 text-foreground hover:bg-white border-0 text-[11px] font-medium">
                  {feed.topic.name}
                </Badge>
              </div>
            )}

            {/* Content */}
            <div className="flex flex-1 flex-col p-4">
              <h3 className="line-clamp-2 text-sm font-semibold leading-snug group-hover:text-foreground/80">
                {feed.title}
              </h3>
              {feed.summary && (
                <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground leading-relaxed">
                  {feed.summary}
                </p>
              )}

              <div className="mt-auto pt-3">
                {/* Source + Time */}
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="font-medium truncate">{feed.rssFeed.name}</span>
                  {feed.publishedAt && (
                    <>
                      <span>·</span>
                      <span className="shrink-0">
                        {formatDistanceToNow(new Date(feed.publishedAt), { addSuffix: true })}
                      </span>
                    </>
                  )}
                </div>

                {/* Status */}
                <div className="mt-2.5 flex gap-2">
                  {feed.scheduledPosts && feed.scheduledPosts.length > 0 ? (
                    <div className="flex flex-1 flex-col gap-1">
                      {feed.scheduledPosts.map((post) => (
                        <div
                          key={post.id}
                          className="flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400"
                        >
                          {post.platform === "TWITTER" ? (
                            <Twitter className="h-3 w-3" />
                          ) : (
                            <Linkedin className="h-3 w-3" />
                          )}
                          <span className="font-medium">
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
                    <div className="flex flex-1 items-center gap-1.5 rounded-lg bg-blue-50 px-2.5 py-1.5 text-[11px] text-blue-600 dark:bg-blue-950/20 dark:text-blue-400">
                      <Clock className="h-3 w-3 animate-pulse" />
                      <span>Being scheduled...</span>
                    </div>
                  )}
                  <a
                    href={feed.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label={`Open ${feed.title} in new tab`}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {hasMore && (
        <div className="flex justify-center pt-4">
          <Button
            variant="outline"
            className="rounded-full px-6"
            onClick={() => setPage((p) => p + 1)}
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
