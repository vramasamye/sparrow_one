"use client"

import { useState } from "react"
import { format } from "date-fns"
import { AlertCircle, Calendar, ExternalLink, Linkedin, MoreVertical, Trash, Twitter } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Skeleton } from "@/components/ui/skeleton"
import { usePosts, useCancelPost } from "@/hooks/use-queries"

interface ScheduledPost {
  id: string
  platform: "TWITTER" | "LINKEDIN"
  content: string
  scheduledFor: string
  status: "SCHEDULED" | "PUBLISHING" | "PUBLISHED" | "FAILED" | "CANCELLED"
  publishedAt: string | null
  platformPostId: string | null
  errorMessage: string | null
  feed: {
    title: string
    url: string
  } | null
}

const statusConfig: Record<string, { label: string; color: string; dot: string }> = {
  SCHEDULED: { label: "Scheduled", color: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  PUBLISHING: { label: "Publishing", color: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  PUBLISHED: { label: "Published", color: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  FAILED: { label: "Failed", color: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" },
  CANCELLED: { label: "Cancelled", color: "bg-gray-50 text-gray-600 border-gray-200", dot: "bg-gray-400" },
}

const filterOptions = [
  { value: "all", label: "All" },
  { value: "SCHEDULED", label: "Scheduled" },
  { value: "PUBLISHED", label: "Published" },
  { value: "FAILED", label: "Failed" },
]

export function PostsList() {
  const [filter, setFilter] = useState<string>("all")

  const { data: posts = [], isLoading: loading } = usePosts(filter)
  const cancelPostMutation = useCancelPost()

  const handleCancel = async (postId: string) => {
    await cancelPostMutation.mutateAsync(postId)
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Segmented Filter Tabs */}
      <div className="inline-flex rounded-lg bg-muted p-1">
        {filterOptions.map((option) => (
          <button
            key={option.value}
            onClick={() => setFilter(option.value)}
            className={`rounded-md px-3.5 py-1.5 text-sm font-medium transition-all ${
              filter === option.value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {/* Posts */}
      {posts.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed py-14 px-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
            <Calendar className="h-5 w-5 text-muted-foreground" />
          </div>
          <h3 className="mt-3 text-sm font-semibold">No posts found</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            {filter === "all"
              ? "No posts yet. Content will appear here as it's generated."
              : `No ${filter.toLowerCase()} posts.`}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {posts.map((post) => {
            const config = statusConfig[post.status] || statusConfig.CANCELLED

            return (
              <div
                key={post.id}
                className="group rounded-xl border bg-card p-4 transition-all hover:shadow-sm"
              >
                {/* Top row: platform + status + menu */}
                <div className="flex items-center gap-2">
                  <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                    post.platform === "TWITTER" ? "bg-sky-500/10" : "bg-[#0A66C2]/10"
                  }`}>
                    {post.platform === "TWITTER" ? (
                      <Twitter className="h-3.5 w-3.5 text-sky-500" />
                    ) : (
                      <Linkedin className="h-3.5 w-3.5 text-[#0A66C2]" />
                    )}
                  </div>

                  <Badge
                    variant="outline"
                    className={`h-5 gap-1 border px-2 text-[10px] font-medium ${config.color}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${config.dot}`} />
                    {config.label}
                  </Badge>

                  {post.feed && (
                    <span className="ml-1 truncate text-xs text-muted-foreground">
                      {post.feed.title}
                    </span>
                  )}

                  <div className="ml-auto">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label="Post options"
                        >
                          <MoreVertical className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {post.feed && (
                          <DropdownMenuItem asChild>
                            <a href={post.feed.url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="mr-2 h-3.5 w-3.5" />
                              View Article
                            </a>
                          </DropdownMenuItem>
                        )}
                        {post.status === "SCHEDULED" && (
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleCancel(post.id)}
                          >
                            <Trash className="mr-2 h-3.5 w-3.5" />
                            Cancel Post
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>

                {/* Content */}
                <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed line-clamp-3">
                  {post.content}
                </p>

                {/* Footer */}
                <div className="mt-3 flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="font-mono">
                    {post.status === "PUBLISHED" && post.publishedAt
                      ? `Published ${format(new Date(post.publishedAt), "MMM d, h:mm a")}`
                      : `Scheduled ${format(new Date(post.scheduledFor), "MMM d, h:mm a")}`}
                  </span>
                  {post.errorMessage && (
                    <span className="flex items-center gap-1 text-destructive">
                      <AlertCircle className="h-3 w-3" />
                      {post.errorMessage}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
