"use client"

import { format } from "date-fns"
import { CheckCircle, ExternalLink, XCircle } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useTransition } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"

interface Feed {
  id: string
  title: string
  url: string
  summary: string | null
  publishedAt: string | null
  status: string
  topic: { name: string }
  rssFeed: { name: string }
}

export function FeedList() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [feeds, setFeeds] = useState<Feed[]>([])
  const [loading, setLoading] = useState(true)
  const [rejectionReason, setRejectionReason] = useState<Record<string, string>>({})

  const status = searchParams.get("status") || "PENDING"

  // Fetch feeds on mount and when status changes
  useState(() => {
    fetchFeeds()
  })

  async function fetchFeeds() {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/feeds?status=${status}`)
      const data = await res.json()
      setFeeds(data.feeds || [])
    } catch (error) {
      console.error("Failed to fetch feeds:", error)
    } finally {
      setLoading(false)
    }
  }

  async function handleAction(feedId: string, action: "approve" | "reject") {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/feeds/${feedId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action,
            rejectionReason: action === "reject" ? rejectionReason[feedId] : undefined,
          }),
        })

        if (res.ok) {
          setFeeds((prev) => prev.filter((f) => f.id !== feedId))
        }
      } catch (error) {
        console.error("Failed to update feed:", error)
      }
    })
  }

  const statusTabs = [
    { value: "PENDING", label: "Pending" },
    { value: "APPROVED", label: "Approved" },
    { value: "REJECTED", label: "Rejected" },
  ]

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-6 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-20 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Status tabs */}
      <div className="flex gap-2">
        {statusTabs.map((tab) => (
          <Button
            key={tab.value}
            variant={status === tab.value ? "default" : "outline"}
            size="sm"
            onClick={() => {
              router.push(`/admin/feeds?status=${tab.value}`)
              setTimeout(fetchFeeds, 100)
            }}
          >
            {tab.label}
          </Button>
        ))}
      </div>

      {/* Feed list */}
      {feeds.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No {status.toLowerCase()} feeds found.
          </CardContent>
        </Card>
      ) : (
        feeds.map((feed) => (
          <Card key={feed.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-lg">{feed.title}</CardTitle>
                  <CardDescription className="flex items-center gap-2">
                    <Badge variant="secondary">{feed.topic.name}</Badge>
                    <span>from {feed.rssFeed.name}</span>
                    {feed.publishedAt && (
                      <span>
                        {format(new Date(feed.publishedAt), "MMM d, yyyy")}
                      </span>
                    )}
                  </CardDescription>
                </div>
                <a
                  href={feed.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>
            </CardHeader>
            <CardContent>
              {feed.summary && (
                <p className="mb-4 text-sm text-muted-foreground line-clamp-3">
                  {feed.summary}
                </p>
              )}

              {status === "PENDING" && (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => handleAction(feed.id, "approve")}
                    disabled={isPending}
                  >
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Approve
                  </Button>
                  <Input
                    placeholder="Rejection reason (optional)"
                    className="max-w-xs"
                    value={rejectionReason[feed.id] || ""}
                    onChange={(e) =>
                      setRejectionReason((prev) => ({
                        ...prev,
                        [feed.id]: e.target.value,
                      }))
                    }
                  />
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => handleAction(feed.id, "reject")}
                    disabled={isPending}
                  >
                    <XCircle className="mr-2 h-4 w-4" />
                    Reject
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  )
}
