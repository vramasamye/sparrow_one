import { Suspense } from "react"
import { Newspaper } from "lucide-react"

import { Skeleton } from "@/components/ui/skeleton"

import { FeedContent } from "./feed-content"
import { FeedFilters } from "./feed-filters"

export default function FeedPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-2 text-amber-600 text-xs font-medium tracking-wide uppercase">
          <Newspaper className="h-3.5 w-3.5" />
          Content Feed
        </div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Your Feed</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Browse curated articles from your topics and track scheduled posts
        </p>
      </div>

      <Suspense
        fallback={
          <div className="flex gap-2">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-8 w-20 rounded-full" />
            ))}
          </div>
        }
      >
        <FeedFilters />
      </Suspense>

      <Suspense
        fallback={
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="rounded-2xl border bg-card">
                <Skeleton className="aspect-video rounded-t-2xl" />
                <div className="p-4 space-y-3">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-5 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        }
      >
        <FeedContent />
      </Suspense>
    </div>
  )
}
