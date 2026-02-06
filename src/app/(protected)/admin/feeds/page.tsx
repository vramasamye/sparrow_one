import { FeedList } from "./feed-list"
import { FeedStats } from "./feed-stats"
import { PlatformStatus } from "./platform-status"

export default function AdminFeedsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Feed Approval</h1>
        <p className="text-muted-foreground">
          Review and approve pending feeds for AI content generation
        </p>
      </div>

      <FeedStats />
      <PlatformStatus />
      <FeedList />
    </div>
  )
}
