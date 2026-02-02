"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCw, PlayCircle, Trash2 } from "lucide-react"
import { toast } from "sonner"

interface QueueStats {
  queued: number
  processing: number
  total: number
  generatedPosts: {
    PENDING: number
    GENERATING: number
    COMPLETED: number
    DISTRIBUTING: number
    DISTRIBUTED: number
    FAILED: number
  }
  queueJobs: Array<{
    feedId: string
    feedTitle: string
    approvedBy: string
    approvedAt: string
    priority: number
  }>
}

export default function AdminQueuePage() {
  const [stats, setStats] = useState<QueueStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(false)

  const fetchStats = async () => {
    try {
      const res = await fetch("/api/admin/queue")
      if (!res.ok) throw new Error("Failed to fetch queue stats")
      const data = await res.json()
      setStats(data)
    } catch (error) {
      toast.error("Failed to load queue stats")
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const processQueue = async () => {
    setProcessing(true)
    try {
      const res = await fetch("/api/admin/queue/process", { method: "POST" })
      if (!res.ok) throw new Error("Failed to process queue")
      const data = await res.json()
      toast.success(data.message || "Queue processed successfully")
      await fetchStats()
    } catch (error) {
      toast.error("Failed to process queue")
      console.error(error)
    } finally {
      setProcessing(false)
    }
  }

  const clearQueue = async () => {
    if (!confirm("Are you sure you want to clear the entire queue? This cannot be undone.")) {
      return
    }

    try {
      const res = await fetch("/api/admin/queue/clear", { method: "POST" })
      if (!res.ok) throw new Error("Failed to clear queue")
      toast.success("Queue cleared successfully")
      await fetchStats()
    } catch (error) {
      toast.error("Failed to clear queue")
      console.error(error)
    }
  }

  useEffect(() => {
    fetchStats()
    const interval = setInterval(fetchStats, 10000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!stats) {
    return (
      <div className="flex items-center justify-center h-96">
        <p className="text-muted-foreground">Failed to load queue stats</p>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Queue Management</h1>
          <p className="text-muted-foreground">Monitor and control the feed processing queue</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchStats}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={processQueue} disabled={processing || stats.queued === 0}>
            {processing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PlayCircle className="h-4 w-4 mr-2" />}
            Process Next
          </Button>
          <Button variant="destructive" onClick={clearQueue} disabled={stats.total === 0}>
            <Trash2 className="h-4 w-4 mr-2" />
            Clear Queue
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Queued</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.queued}</div>
            <p className="text-xs text-muted-foreground mt-1">Waiting to be processed</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Processing</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.processing}</div>
            <p className="text-xs text-muted-foreground mt-1">Currently being processed</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground mt-1">Queued + Processing</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generated Posts Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-6">
            {Object.entries(stats.generatedPosts).map(([status, count]) => (
              <div key={status} className="flex items-center justify-between p-3 border rounded-lg">
                <span className="text-sm text-muted-foreground">{status}</span>
                <Badge>{count}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Queue Jobs ({stats.queueJobs.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.queueJobs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>Queue is empty</p>
            </div>
          ) : (
            <div className="space-y-2">
              {stats.queueJobs.map((job, i) => (
                <div key={job.feedId} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">#{i + 1}</Badge>
                      <p className="font-medium truncate">{job.feedTitle}</p>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      <span>By: {job.approvedBy}</span> • <span>{new Date(job.approvedAt).toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
