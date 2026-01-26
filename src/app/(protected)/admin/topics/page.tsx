import { Suspense } from "react"

import { TopicsList } from "./topics-list"
import { TopicsStats } from "./topics-stats"

export default function AdminTopicsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Topics & RSS Feeds</h1>
        <p className="text-muted-foreground">
          Manage content topics and their RSS feed sources
        </p>
      </div>

      <Suspense fallback={<div>Loading stats...</div>}>
        <TopicsStats />
      </Suspense>

      <Suspense fallback={<div>Loading topics...</div>}>
        <TopicsList />
      </Suspense>
    </div>
  )
}
