"use client"

import { useState } from "react"
import { format } from "date-fns"
import { ExternalLink, Linkedin, MoreVertical, Trash, Twitter } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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

const statusColors: Record<string, string> = {
  SCHEDULED: "bg-blue-100 text-blue-700",
  PUBLISHING: "bg-yellow-100 text-yellow-700",
  PUBLISHED: "bg-green-100 text-green-700",
  FAILED: "bg-red-100 text-red-700",
  CANCELLED: "bg-gray-100 text-gray-700",
}

export function PostsList() {
  const [filter, setFilter] = useState<string>("all")

  // React Query hooks
  const { data: posts = [], isLoading: loading } = usePosts(filter)
  const cancelPostMutation = useCancelPost()

  const handleCancel = async (postId: string) => {
    await cancelPostMutation.mutateAsync(postId)
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex gap-2">
        {["all", "SCHEDULED", "PUBLISHED", "FAILED"].map((status) => (
          <Button
            key={status}
            variant={filter === status ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter(status)}
          >
            {status === "all" ? "All" : status.charAt(0) + status.slice(1).toLowerCase()}
          </Button>
        ))}
      </div>

      {/* Posts List */}
      {posts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {filter === "all"
                ? "No posts yet. Start by generating posts from your feed."
                : `No ${filter.toLowerCase()} posts.`}
            </p>
          </CardContent>
        </Card>
      ) : (
        posts.map((post) => (
          <Card key={post.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  {post.platform === "TWITTER" ? (
                    <Twitter className="h-5 w-5 text-[#1DA1F2]" />
                  ) : (
                    <Linkedin className="h-5 w-5 text-[#0A66C2]" />
                  )}
                  <Badge variant="secondary" className={statusColors[post.status]}>
                    {post.status.charAt(0) + post.status.slice(1).toLowerCase()}
                  </Badge>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Post options">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {post.feed && (
                      <DropdownMenuItem asChild>
                        <a href={post.feed.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="mr-2 h-4 w-4" />
                          View Article
                        </a>
                      </DropdownMenuItem>
                    )}
                    {post.status === "SCHEDULED" && (
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => handleCancel(post.id)}
                      >
                        <Trash className="mr-2 h-4 w-4" />
                        Cancel Post
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              {post.feed && (
                <CardDescription className="line-clamp-1">
                  {post.feed.title}
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm">{post.content}</p>
              <div className="mt-4 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  {post.status === "PUBLISHED" && post.publishedAt
                    ? `Published ${format(new Date(post.publishedAt), "PPp")}`
                    : `Scheduled for ${format(new Date(post.scheduledFor), "PPp")}`}
                </span>
                {post.errorMessage && (
                  <span className="text-destructive">{post.errorMessage}</span>
                )}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
