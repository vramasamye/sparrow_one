"use client"

import { format } from "date-fns"
import { CheckCircle, ExternalLink, XCircle, Filter, ChevronDown, ChevronUp } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useTransition, useEffect, useCallback } from "react"

import { useAdminFeeds, useAdminTopics, useApproveFeed, useBulkApproveFeed } from "@/hooks/use-queries"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"

// Parse topic relevance score from moderationReasoning prefix like "[Topic relevance: 8/10] ..."
function parseTopicRelevance(reasoning: string | null): number | null {
  if (!reasoning) return null
  const match = reasoning.match(/\[Topic relevance:\s*(\d+)\/10\]/)
  return match ? parseInt(match[1]) : null
}

function TopicRelevanceBadge({ score }: { score: number }) {
  const variant = score >= 8 ? "default" : score >= 6 ? "secondary" : "destructive"
  return (
    <Badge variant={variant} className="text-xs font-mono">
      TR: {score}/10
    </Badge>
  )
}

function QualityScoreBadge({ score }: { score: number }) {
  const color =
    score >= 85
      ? "bg-green-100 text-green-800 border-green-300"
      : score >= 60
        ? "bg-yellow-100 text-yellow-800 border-yellow-300"
        : "bg-red-100 text-red-800 border-red-300"
  return (
    <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${color}`}>
      {score}/100
    </span>
  )
}

export function FeedList() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  const [rejectionReason, setRejectionReason] = useState<Record<string, string>>({})
  const [selectedFeeds, setSelectedFeeds] = useState<string[]>([])
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set())

  const status = searchParams.get("status") || "PENDING"
  const topicId = searchParams.get("topicId") || undefined

  // React Query hooks
  const { data: feeds = [], isLoading: loading } = useAdminFeeds(status, topicId)
  const { data: topics = [] } = useAdminTopics()
  const approveFeedMutation = useApproveFeed()
  const bulkApproveMutation = useBulkApproveFeed()

  // Clear selection when status or topic changes
  useEffect(() => {
    setSelectedFeeds([])
  }, [status, topicId])

  const toggleSelect = useCallback((feedId: string) => {
    setSelectedFeeds((prev) =>
      prev.includes(feedId) ? prev.filter((id) => id !== feedId) : [...prev, feedId]
    )
  }, [])

  const toggleSelectAll = useCallback(() => {
    if (selectedFeeds.length === feeds.length) {
      setSelectedFeeds([])
    } else {
      setSelectedFeeds(feeds.map((f: any) => f.id))
    }
  }, [selectedFeeds.length, feeds])

  const toggleCardExpand = useCallback((feedId: string) => {
    setExpandedCards((prev) => {
      const next = new Set(prev)
      if (next.has(feedId)) {
        next.delete(feedId)
      } else {
        next.add(feedId)
      }
      return next
    })
  }, [])

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
        } catch {
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
        } catch {
          // Error handling is done in the mutation
        }
      })
    },
    [selectedFeeds, bulkApproveMutation]
  )

  const setTopicFilter = useCallback(
    (newTopicId: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (newTopicId) {
        params.set("topicId", newTopicId)
      } else {
        params.delete("topicId")
      }
      router.push(`/admin/feeds?${params.toString()}`)
    },
    [router, searchParams]
  )

  const setStatus = useCallback(
    (newStatus: string) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set("status", newStatus)
      router.push(`/admin/feeds?${params.toString()}`)
    },
    [router, searchParams]
  )

  const statusTabs = [
    { value: "PENDING", label: "Pending" },
    { value: "APPROVED", label: "Approved" },
    { value: "REJECTED", label: "Rejected" },
  ]

  // Group feeds by topic for display
  const feedsByTopic = feeds.reduce<Record<string, { topicName: string; feeds: any[] }>>((acc, feed: any) => {
    const tid = feed.topic.id
    if (!acc[tid]) {
      acc[tid] = { topicName: feed.topic.name, feeds: [] }
    }
    acc[tid].feeds.push(feed)
    return acc
  }, {})

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <Skeleton className="h-5 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2" />
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Controls Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Status Tabs */}
        <div className="flex gap-2">
          {statusTabs.map((tab) => (
            <Button
              key={tab.value}
              variant={status === tab.value ? "default" : "outline"}
              size="sm"
              onClick={() => setStatus(tab.value)}
            >
              {tab.label}
            </Button>
          ))}
        </div>

        {/* Topic Filter */}
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={topicId || ""}
            onChange={(e) => setTopicFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">All Topics</option>
            {topics.map((topic: any) => (
              <option key={topic.id} value={topic.id}>
                {topic.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {feeds.length > 0 && status === "PENDING" && (
        <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-3">
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
                {selectedFeeds.length} selected
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
                <CheckCircle className="mr-1.5 h-3.5 w-3.5" />
                Approve ({selectedFeeds.length})
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-red-500 text-red-600 hover:bg-red-50 hover:text-red-700"
                onClick={() => handleBulkAction("reject")}
                disabled={isPending}
              >
                <XCircle className="mr-1.5 h-3.5 w-3.5" />
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
            No {status.toLowerCase()} feeds found
            {topicId ? " for this topic" : ""}.
          </CardContent>
        </Card>
      ) : topicId ? (
        // Flat list when filtered by topic
        <div className="space-y-2">
          {feeds.map((feed: any) => (
            <FeedCard
              key={feed.id}
              feed={feed}
              status={status}
              isPending={isPending}
              isSelected={selectedFeeds.includes(feed.id)}
              isExpanded={expandedCards.has(feed.id)}
              rejectionReason={rejectionReason[feed.id] || ""}
              onToggleSelect={() => toggleSelect(feed.id)}
              onToggleExpand={() => toggleCardExpand(feed.id)}
              onAction={handleAction}
              onRejectionReasonChange={(val) =>
                setRejectionReason((prev) => ({ ...prev, [feed.id]: val }))
              }
              showTopic={false}
            />
          ))}
        </div>
      ) : (
        // Grouped by topic when showing all
        <div className="space-y-6">
          {Object.entries(feedsByTopic).map(([tid, { topicName, feeds: topicFeeds }]) => (
            <div key={tid}>
              <div className="flex items-center gap-2 mb-2">
                <h3 className="text-sm font-semibold text-foreground">{topicName}</h3>
                <Badge variant="outline" className="text-xs">
                  {topicFeeds.length}
                </Badge>
              </div>
              <div className="space-y-2">
                {topicFeeds.map((feed: any) => (
                  <FeedCard
                    key={feed.id}
                    feed={feed}
                    status={status}
                    isPending={isPending}
                    isSelected={selectedFeeds.includes(feed.id)}
                    isExpanded={expandedCards.has(feed.id)}
                    rejectionReason={rejectionReason[feed.id] || ""}
                    onToggleSelect={() => toggleSelect(feed.id)}
                    onToggleExpand={() => toggleCardExpand(feed.id)}
                    onAction={handleAction}
                    onRejectionReasonChange={(val) =>
                      setRejectionReason((prev) => ({ ...prev, [feed.id]: val }))
                    }
                    showTopic={false}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// Compact feed card component
function FeedCard({
  feed,
  status,
  isPending,
  isSelected,
  isExpanded,
  rejectionReason,
  onToggleSelect,
  onToggleExpand,
  onAction,
  onRejectionReasonChange,
  showTopic,
}: {
  feed: any
  status: string
  isPending: boolean
  isSelected: boolean
  isExpanded: boolean
  rejectionReason: string
  onToggleSelect: () => void
  onToggleExpand: () => void
  onAction: (feedId: string, action: "approve" | "reject") => void
  onRejectionReasonChange: (val: string) => void
  showTopic: boolean
}) {
  const topicRelevance = parseTopicRelevance(feed.moderationReasoning)
  const cleanReasoning = feed.moderationReasoning
    ? feed.moderationReasoning.replace(/^\[Topic relevance:\s*\d+\/10\]\s*/, "")
    : null

  return (
    <Card className={`transition-colors ${isSelected ? "border-primary bg-primary/5" : ""}`}>
      <CardContent className="p-3">
        {/* Main row: checkbox + title + badges + actions */}
        <div className="flex items-start gap-3">
          {/* Checkbox */}
          {status === "PENDING" && (
            <div className="pt-0.5">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 accent-primary"
                checked={isSelected}
                onChange={onToggleSelect}
                aria-label={`Select ${feed.title}`}
              />
            </div>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Title row */}
            <div className="flex items-start gap-2">
              <a
                href={feed.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium hover:underline line-clamp-1 flex-1"
              >
                {feed.title}
              </a>
              <a
                href={feed.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-foreground shrink-0"
                aria-label="Open article"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>

            {/* Meta row */}
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {showTopic && (
                <Badge variant="secondary" className="text-xs">
                  {feed.topic.name}
                </Badge>
              )}
              <span className="text-xs text-muted-foreground">
                {feed.rssFeed.name}
              </span>
              {feed.publishedAt && (
                <span className="text-xs text-muted-foreground">
                  {format(new Date(feed.publishedAt), "MMM d")}
                </span>
              )}

              {/* Scores */}
              {feed.qualityScore !== null && (
                <QualityScoreBadge score={feed.qualityScore} />
              )}
              {!feed.scoredAt && (
                <Badge variant="outline" className="text-xs border-yellow-400 text-yellow-600">
                  Unscored
                </Badge>
              )}
              {topicRelevance !== null && (
                <TopicRelevanceBadge score={topicRelevance} />
              )}

              {/* Status badges */}
              {feed.autoApproved && (
                <Badge variant="outline" className="text-xs border-green-400 text-green-600">
                  Auto-Approved
                </Badge>
              )}
              {feed.autoRejected && (
                <Badge variant="outline" className="text-xs border-red-400 text-red-600">
                  Auto-Rejected
                </Badge>
              )}

              {/* Safety flags */}
              {feed.isSalesContent && (
                <Badge variant="destructive" className="text-xs">Sales</Badge>
              )}
              {feed.hasPromoCodes && (
                <Badge variant="destructive" className="text-xs">Promo</Badge>
              )}
              {feed.isClickbait && (
                <Badge variant="destructive" className="text-xs">Clickbait</Badge>
              )}
              {feed.moderationCategory && feed.moderationCategory !== "safe" && (
                <Badge variant="destructive" className="text-xs">
                  {feed.moderationCategory}
                </Badge>
              )}

              {/* Expand toggle */}
              {feed.scoredAt && (
                <button
                  onClick={onToggleExpand}
                  className="text-muted-foreground hover:text-foreground ml-auto"
                  aria-label={isExpanded ? "Collapse details" : "Expand details"}
                >
                  {isExpanded ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </button>
              )}
            </div>

            {/* Expanded details */}
            {isExpanded && feed.scoredAt && (
              <div className="mt-2 rounded border bg-muted/30 p-2 text-xs space-y-1">
                {feed.summary && (
                  <p className="text-muted-foreground line-clamp-2">{feed.summary}</p>
                )}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
                  {feed.sourceAuthorityScore !== null && (
                    <span>Source: {feed.sourceAuthorityScore}/20</span>
                  )}
                  {feed.recencyScore !== null && (
                    <span>Recency: {feed.recencyScore}/15</span>
                  )}
                  {feed.metadataScore !== null && (
                    <span>Metadata: {feed.metadataScore}/15</span>
                  )}
                  {feed.moderationScore !== null && (
                    <span>Confidence: {Math.round(feed.moderationScore * 100)}%</span>
                  )}
                </div>
                {cleanReasoning && (
                  <p className="text-muted-foreground">
                    <span className="font-medium">AI:</span> {cleanReasoning}
                  </p>
                )}
              </div>
            )}

            {/* Actions for PENDING */}
            {status === "PENDING" && (
              <div className="flex items-center gap-2 mt-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs border-green-500 text-green-600 hover:bg-green-50 hover:text-green-700"
                  onClick={() => onAction(feed.id, "approve")}
                  disabled={isPending}
                >
                  <CheckCircle className="mr-1 h-3 w-3" />
                  Approve
                </Button>
                <Input
                  placeholder="Reason (optional)"
                  className="h-7 text-xs max-w-[200px]"
                  value={rejectionReason}
                  onChange={(e) => onRejectionReasonChange(e.target.value)}
                  name={`rejection-reason-${feed.id}`}
                  autoComplete="off"
                  aria-label="Rejection reason"
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2 text-xs border-red-500 text-red-600 hover:bg-red-50 hover:text-red-700"
                  onClick={() => onAction(feed.id, "reject")}
                  disabled={isPending}
                >
                  <XCircle className="mr-1 h-3 w-3" />
                  Reject
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
