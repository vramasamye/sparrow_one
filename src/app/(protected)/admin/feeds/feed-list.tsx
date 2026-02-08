"use client"

import { format } from "date-fns"
import { CheckCircle, ExternalLink, XCircle, Filter, ChevronDown, ChevronUp } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useTransition, useEffect, useCallback } from "react"

import { useAdminFeeds, useAdminTopics, useApproveFeed, useBulkApproveFeed } from "@/hooks/use-queries"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"

function parseTopicRelevance(reasoning: string | null): number | null {
  if (!reasoning) return null
  const match = reasoning.match(/\[Topic relevance:\s*(\d+)\/10\]/)
  return match ? parseInt(match[1]) : null
}

function TopicRelevanceBadge({ score }: { score: number }) {
  const color =
    score >= 8
      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
      : score >= 6
        ? "border-amber-300 bg-amber-50 text-amber-700"
        : "border-red-300 bg-red-50 text-red-700"
  return (
    <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold font-mono ${color}`}>
      TR {score}/10
    </span>
  )
}

function QualityScoreBadge({ score }: { score: number }) {
  const color =
    score >= 85
      ? "border-emerald-300 bg-emerald-50 text-emerald-700"
      : score >= 60
        ? "border-amber-300 bg-amber-50 text-amber-700"
        : "border-red-300 bg-red-50 text-red-700"
  return (
    <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold font-mono ${color}`}>
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

  const { data: feeds = [], isLoading: loading } = useAdminFeeds(status, topicId)
  const { data: topics = [] } = useAdminTopics()
  const approveFeedMutation = useApproveFeed()
  const bulkApproveMutation = useBulkApproveFeed()

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
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border bg-card p-4">
            <Skeleton className="h-4 w-3/4 mb-2" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Status Tabs */}
        <div className="inline-flex rounded-lg border bg-muted/40 p-0.5">
          {statusTabs.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatus(tab.value)}
              className={`rounded-md px-4 py-1.5 text-sm font-medium transition-all ${
                status === tab.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Topic Filter */}
        <div className="flex items-center gap-2">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <select
            value={topicId || ""}
            onChange={(e) => setTopicFilter(e.target.value)}
            className="h-8 rounded-lg border border-input bg-background px-3 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
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

      {/* Bulk Actions */}
      {feeds.length > 0 && status === "PENDING" && (
        <div className="flex items-center justify-between rounded-xl border bg-muted/30 px-4 py-2.5">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 rounded border-gray-300 accent-primary"
              checked={selectedFeeds.length === feeds.length && feeds.length > 0}
              onChange={toggleSelectAll}
              id="select-all"
              aria-label="Select all feeds"
            />
            <label htmlFor="select-all" className="cursor-pointer text-xs font-medium">
              All ({feeds.length})
            </label>
            {selectedFeeds.length > 0 && (
              <span className="text-xs text-muted-foreground">
                {selectedFeeds.length} selected
              </span>
            )}
          </div>

          {selectedFeeds.length > 0 && (
            <div className="flex gap-2">
              <Button
                size="sm"
                className="h-7 gap-1 bg-emerald-600 px-3 text-xs text-white hover:bg-emerald-700"
                onClick={() => handleBulkAction("approve")}
                disabled={isPending}
              >
                <CheckCircle className="h-3 w-3" />
                Approve ({selectedFeeds.length})
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1 border-red-300 px-3 text-xs text-red-600 hover:bg-red-50"
                onClick={() => handleBulkAction("reject")}
                disabled={isPending}
              >
                <XCircle className="h-3 w-3" />
                Reject
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Feed List */}
      {feeds.length === 0 ? (
        <div className="rounded-xl border bg-card py-12 text-center text-sm text-muted-foreground">
          No {status.toLowerCase()} feeds found{topicId ? " for this topic" : ""}.
        </div>
      ) : topicId ? (
        <div className="space-y-1.5">
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
        <div className="space-y-6">
          {Object.entries(feedsByTopic).map(([tid, { topicName, feeds: topicFeeds }]) => (
            <div key={tid}>
              <div className="mb-2 flex items-center gap-2">
                <h3 className="text-sm font-semibold">{topicName}</h3>
                <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                  {topicFeeds.length}
                </Badge>
              </div>
              <div className="space-y-1.5">
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
    <div
      className={`rounded-xl border bg-card p-3 transition-all ${
        isSelected ? "border-primary/40 bg-primary/[0.02] ring-1 ring-primary/20" : "hover:border-border/80"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Checkbox */}
        {status === "PENDING" && (
          <div className="pt-0.5">
            <input
              type="checkbox"
              className="h-3.5 w-3.5 rounded border-gray-300 accent-primary"
              checked={isSelected}
              onChange={onToggleSelect}
              aria-label={`Select ${feed.title}`}
            />
          </div>
        )}

        {/* Content */}
        <div className="min-w-0 flex-1">
          {/* Title */}
          <div className="flex items-start gap-2">
            <a
              href={feed.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 text-sm font-medium leading-snug hover:underline line-clamp-1"
            >
              {feed.title}
            </a>
            <a
              href={feed.url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-muted-foreground hover:text-foreground"
              aria-label="Open article"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>

          {/* Meta */}
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {showTopic && (
              <Badge variant="secondary" className="h-5 text-[10px]">
                {feed.topic.name}
              </Badge>
            )}
            <span className="text-[11px] text-muted-foreground">{feed.rssFeed.name}</span>
            {feed.publishedAt && (
              <>
                <span className="text-[10px] text-muted-foreground/50">&middot;</span>
                <span className="text-[11px] text-muted-foreground">
                  {format(new Date(feed.publishedAt), "MMM d")}
                </span>
              </>
            )}

            {/* Scores */}
            {feed.qualityScore !== null && <QualityScoreBadge score={feed.qualityScore} />}
            {!feed.scoredAt && (
              <span className="rounded-md border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] font-medium text-amber-600">
                Unscored
              </span>
            )}
            {topicRelevance !== null && <TopicRelevanceBadge score={topicRelevance} />}

            {/* Auto badges */}
            {feed.autoApproved && (
              <span className="rounded-md border border-emerald-300 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-600">
                Auto
              </span>
            )}
            {feed.autoRejected && (
              <span className="rounded-md border border-red-300 bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-600">
                Auto-Rej
              </span>
            )}

            {/* Safety flags */}
            {feed.isSalesContent && (
              <Badge variant="destructive" className="h-5 text-[10px]">Sales</Badge>
            )}
            {feed.hasPromoCodes && (
              <Badge variant="destructive" className="h-5 text-[10px]">Promo</Badge>
            )}
            {feed.isClickbait && (
              <Badge variant="destructive" className="h-5 text-[10px]">Clickbait</Badge>
            )}
            {feed.moderationCategory && feed.moderationCategory !== "safe" && (
              <Badge variant="destructive" className="h-5 text-[10px]">
                {feed.moderationCategory}
              </Badge>
            )}

            {/* Expand */}
            {feed.scoredAt && (
              <button
                onClick={onToggleExpand}
                className="ml-auto text-muted-foreground hover:text-foreground"
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

          {/* Expanded */}
          {isExpanded && feed.scoredAt && (
            <div className="mt-2 rounded-lg border bg-muted/20 p-3 text-xs space-y-1.5">
              {feed.summary && (
                <p className="text-muted-foreground leading-relaxed line-clamp-2">{feed.summary}</p>
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted-foreground">
                {feed.sourceAuthorityScore !== null && (
                  <span>Source: {feed.sourceAuthorityScore}/20</span>
                )}
                {feed.recencyScore !== null && (
                  <span>Recency: {feed.recencyScore}/15</span>
                )}
                {feed.metadataScore !== null && (
                  <span>Meta: {feed.metadataScore}/15</span>
                )}
                {feed.moderationScore !== null && (
                  <span>Conf: {Math.round(feed.moderationScore * 100)}%</span>
                )}
              </div>
              {cleanReasoning && (
                <p className="text-muted-foreground">
                  <span className="font-medium text-foreground/70">AI:</span> {cleanReasoning}
                </p>
              )}
            </div>
          )}

          {/* Pending Actions */}
          {status === "PENDING" && (
            <div className="mt-2 flex items-center gap-2">
              <Button
                size="sm"
                className="h-7 gap-1 bg-emerald-600 px-3 text-xs text-white hover:bg-emerald-700"
                onClick={() => onAction(feed.id, "approve")}
                disabled={isPending}
              >
                <CheckCircle className="h-3 w-3" />
                Approve
              </Button>
              <Input
                placeholder="Reason (optional)"
                className="h-7 max-w-[180px] text-xs"
                value={rejectionReason}
                onChange={(e) => onRejectionReasonChange(e.target.value)}
                name={`rejection-reason-${feed.id}`}
                autoComplete="off"
                aria-label="Rejection reason"
              />
              <Button
                size="sm"
                variant="outline"
                className="h-7 gap-1 border-red-300 px-3 text-xs text-red-600 hover:bg-red-50"
                onClick={() => onAction(feed.id, "reject")}
                disabled={isPending}
              >
                <XCircle className="h-3 w-3" />
                Reject
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
