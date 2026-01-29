"use client"

import { format } from "date-fns"
import { CheckCircle, ExternalLink, XCircle, CheckSquare, Square } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useTransition, useEffect, useCallback } from "react"

import { useAdminFeeds, useApproveFeed, useBulkApproveFeed } from "@/hooks/use-queries"

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
  const [rejectionReason, setRejectionReason] = useState<Record<string, string>>({})
  const [selectedFeeds, setSelectedFeeds] = useState<string[]>([])

  const status = searchParams.get("status") || "PENDING"

  // React Query hooks
  const { data: feeds = [], isLoading: loading } = useAdminFeeds(status)
  const approveFeedMutation = useApproveFeed()
  const bulkApproveMutation = useBulkApproveFeed()

  // Clear selection when status changes
  useEffect(() => {
    setSelectedFeeds([])
  }, [status])

  // Toggle selection for a single feed
  const toggleSelect = useCallback((feedId: string) => {
    setSelectedFeeds((prev) =>
      prev.includes(feedId)
        ? prev.filter((id) => id !== feedId)
        : [...prev, feedId]
    )
  }, [])

  // Toggle select all
  const toggleSelectAll = useCallback(() => {
    if (selectedFeeds.length === feeds.length) {
      setSelectedFeeds([])
    } else {
      setSelectedFeeds(feeds.map((f) => f.id))
    }
  }, [selectedFeeds.length, feeds])

  const handleAction = useCallback(
    async (feedId: string, action: "approve" | "reject") => {
      startTransition(async () => {
        try {
          await approveFeedMutation.mutateAsync({
            feedId,
            action,
            rejectionReason: action === "reject" ? rejectionReason[feedId] : undefined,
          })
          setSelectedFeeds((prev) => prev.filter((id) => id !== feedId))
        } catch (error) {
          // Error handling is done in the mutation
        }
      })
    },
    [rejectionReason, approveFeedMutation]
  )

  const handleBulkAction = useCallback(
    async (action: "approve" | "reject") => {
      if (selectedFeeds.length === 0) return

      startTransition(async () => {
        try {
          await bulkApproveMutation.mutateAsync({ feedIds: selectedFeeds, action })
          setSelectedFeeds([])
        } catch (error) {
          // Error handling is done in the mutation
        }
      })
    },
    [selectedFeeds, bulkApproveMutation]
  )

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
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {statusTabs.map((tab) => (
            <Button
              key={tab.value}
              variant={status === tab.value ? "default" : "outline"}
              size="sm"
              onClick={() => {
                router.push(`/admin/feeds?status=${tab.value}`)
              }}
            >
              {tab.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Bulk Action Bar (Only visible when items are selected) */}
      {feeds.length > 0 && status === "PENDING" && (
        <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-3 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 accent-primary"
                checked={selectedFeeds.length === feeds.length && feeds.length > 0}
                onChange={toggleSelectAll}
                id="select-all"
                aria-label="Select all feeds"
              />
              <label htmlFor="select-all" className="text-sm font-medium cursor-pointer">
                Select All ({feeds.length})
              </label>
            </div>
            {selectedFeeds.length > 0 && (
              <span className="text-sm text-muted-foreground">
                • {selectedFeeds.length} selected
              </span>
            )}
          </div>
          
          {selectedFeeds.length > 0 && (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="border-green-500 text-green-600 hover:bg-green-50 hover:text-green-700"
                onClick={() => handleBulkAction("approve")}
                disabled={isPending}
              >
                <CheckCircle className="mr-2 h-4 w-4" />
                Approve ({selectedFeeds.length})
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-red-500 text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={() => handleBulkAction("reject")}
                disabled={isPending}
              >
                <XCircle className="mr-2 h-4 w-4" />
                Reject ({selectedFeeds.length})
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Feed list */}
      {feeds.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No {status.toLowerCase()} feeds found.
          </CardContent>
        </Card>
      ) : (
        feeds.map((feed) => (
          <Card key={feed.id} className={selectedFeeds.includes(feed.id) ? "border-primary bg-primary/5" : ""}>
            <CardHeader>
              <div className="flex items-start gap-4">
                {/* Checkbox */}
                {status === "PENDING" && (
                  <div className="pt-1">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 accent-primary"
                      checked={selectedFeeds.includes(feed.id)}
                      onChange={() => toggleSelect(feed.id)}
                      aria-label={`Select ${feed.title}`}
                    />
                  </div>
                )}
                
                <div className="flex-1 space-y-1">
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{feed.title}</CardTitle>
                    <a
                      href={feed.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-foreground"
                      aria-label={`Open ${feed.title} in new tab`}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  </div>
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
              </div>
            </CardHeader>
            <CardContent className={status === "PENDING" ? "pl-12" : ""}>
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
                    placeholder="Rejection reason (optional)…"
                    className="max-w-xs"
                    value={rejectionReason[feed.id] || ""}
                    onChange={(e) =>
                      setRejectionReason((prev) => ({
                        ...prev,
                        [feed.id]: e.target.value,
                      }))
                    }
                    name={`rejection-reason-${feed.id}`}
                    autoComplete="off"
                    aria-label="Rejection reason"
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
