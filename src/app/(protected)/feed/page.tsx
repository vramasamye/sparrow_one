import { Suspense } from "react"

import { FeedContent } from "./feed-content"
import { FeedFilters } from "./feed-filters"

export default function FeedPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Feed</h1>
        <p className="text-muted-foreground">
          Browse approved content from your topics and create posts
        </p>
      </div>

      <Suspense fallback={<div>Loading filters…</div>}>
        <FeedFilters />
      </Suspense>

      <Suspense fallback={<div>Loading content…</div>}>
        <FeedContent />
      </Suspense>
    </div>
  )
}
