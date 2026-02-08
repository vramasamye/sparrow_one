import { FeedList } from "./feed-list"
import { FeedStats } from "./feed-stats"
import { PlatformStatus } from "./platform-status"

export default function AdminFeedsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Page Header */}
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Feed Approval</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review, approve, and manage the content pipeline
          </p>
        </div>
      </div>

      {/* Stats + Platform Status Row */}
      <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
        <FeedStats />
        <PlatformStatus />
      </div>

      {/* Feed List */}
      <FeedList />
    </div>
  )
}
