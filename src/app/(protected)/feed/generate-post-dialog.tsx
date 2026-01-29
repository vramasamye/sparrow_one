"use client"

import { useEffect, useState } from "react"
import { AlertCircle, Clock, Linkedin, Loader2, RefreshCw, Twitter } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"

interface FeedItem {
  id: string
  title: string
  url: string
  summary: string | null
}

interface GeneratePostDialogProps {
  feed: FeedItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function GeneratePostDialog({ feed, open, onOpenChange }: GeneratePostDialogProps) {
  const [platform, setPlatform] = useState<"twitter" | "linkedin">("twitter")
  const [generatedContent, setGeneratedContent] = useState("")
  const [generating, setGenerating] = useState(false)
  const [scheduling, setScheduling] = useState(false)
  const [rateLimitWait, setRateLimitWait] = useState(0)
  const [remainingToday, setRemainingToday] = useState<number | null>(null)

  // Countdown timer for rate limit
  useEffect(() => {
    if (rateLimitWait > 0) {
      const timer = setInterval(() => {
        setRateLimitWait((prev) => Math.max(0, prev - 1))
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [rateLimitWait])

  // Check rate limit status when dialog opens
  useEffect(() => {
    if (open) {
      fetch("/api/ai/generate")
        .then((res) => res.json())
        .then((data) => {
          if (!data.canRequest) {
            setRateLimitWait(data.waitSeconds)
          }
          setRemainingToday(data.remainingToday)
        })
        .catch(() => {})
    }
  }, [open])

  async function handleGenerate() {
    if (!feed || rateLimitWait > 0) return

    setGenerating(true)
    setGeneratedContent("")

    try {
      const response = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedId: feed.id,
          platform,
        }),
      })

      const data = await response.json()

      if (response.status === 429) {
        // Rate limited
        setRateLimitWait(data.waitSeconds || 10)
        setRemainingToday(data.remainingToday)
        toast.error(`Rate limited. Please wait ${data.waitSeconds} seconds.`)
        return
      }

      if (!response.ok) throw new Error(data.error || "Failed to generate content")

      setGeneratedContent(data.content)
      // Update remaining count
      if (remainingToday !== null) {
        setRemainingToday(remainingToday - 1)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate post. Please try again.")
    } finally {
      setGenerating(false)
    }
  }

  async function handleSchedule() {
    if (!feed || !generatedContent) return

    setScheduling(true)

    try {
      const response = await fetch("/api/posts/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          feedId: feed.id,
          platform,
          content: generatedContent,
        }),
      })

      if (!response.ok) throw new Error("Failed to schedule post")

      toast.success("Post scheduled successfully!")
      onOpenChange(false)
      setGeneratedContent("")
    } catch {
      toast.error("Failed to schedule post. Please try again.")
    } finally {
      setScheduling(false)
    }
  }

  const characterLimit = platform === "twitter" ? 280 : 3000
  const characterCount = generatedContent.length
  const isOverLimit = characterCount > characterLimit

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Generate Post</DialogTitle>
          <DialogDescription className="line-clamp-2">{feed?.title}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Platform Selection */}
          <div className="space-y-2">
            <Label>Platform</Label>
            <div className="flex gap-2">
              <Button
                variant={platform === "twitter" ? "default" : "outline"}
                className="flex-1"
                onClick={() => {
                  setPlatform("twitter")
                  setGeneratedContent("")
                }}
              >
                <Twitter className="mr-2 h-4 w-4" />
                Twitter / X
              </Button>
              <Button
                variant={platform === "linkedin" ? "default" : "outline"}
                className="flex-1"
                onClick={() => {
                  setPlatform("linkedin")
                  setGeneratedContent("")
                }}
              >
                <Linkedin className="mr-2 h-4 w-4" />
                LinkedIn
              </Button>
            </div>
          </div>

          <Separator />

          {/* Rate Limit Info */}
          {(rateLimitWait > 0 || remainingToday !== null) && (
            <div className="flex items-center gap-4 rounded-lg bg-muted p-3 text-sm">
              {rateLimitWait > 0 ? (
                <div className="flex items-center gap-2 text-yellow-600">
                  <Clock className="h-4 w-4" />
                  <span>Wait {rateLimitWait}s before next request</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <AlertCircle className="h-4 w-4" />
                  <span>{remainingToday} AI generations remaining today</span>
                </div>
              )}
            </div>
          )}

          {/* Generated Content */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Generated Content</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleGenerate}
                disabled={generating || rateLimitWait > 0}
              >
                {generating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : rateLimitWait > 0 ? (
                  <Clock className="mr-2 h-4 w-4" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                {rateLimitWait > 0
                  ? `Wait ${rateLimitWait}s`
                  : generatedContent
                    ? "Regenerate"
                    : "Generate"}
              </Button>
            </div>

            {generating ? (
              <div className="flex h-40 items-center justify-center rounded-lg border bg-muted">
                <div className="text-center">
                  <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
                  <p className="mt-2 text-sm text-muted-foreground">Generating content…</p>
                </div>
              </div>
            ) : generatedContent ? (
              <div className="space-y-2">
                <textarea
                  className="min-h-40 w-full resize-none rounded-lg border bg-background p-3 text-sm"
                  value={generatedContent}
                  onChange={(e) => setGeneratedContent(e.target.value)}
                  aria-label="Generated post content"
                  name="post-content"
                />
                <div
                  className={`text-right text-xs ${isOverLimit ? "text-destructive" : "text-muted-foreground"}`}
                >
                  {characterCount} / {characterLimit}
                </div>
              </div>
            ) : (
              <div className="flex h-40 items-center justify-center rounded-lg border border-dashed bg-muted/50">
                <p className="text-sm text-muted-foreground">
                  Click &quot;Generate&quot; to create a {platform === "twitter" ? "tweet" : "LinkedIn post"}
                </p>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleSchedule}
            disabled={!generatedContent || isOverLimit || scheduling}
          >
            {scheduling ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Scheduling…
              </>
            ) : (
              "Schedule Post"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
