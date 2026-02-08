import { Suspense } from "react"
import { Calendar } from "lucide-react"

import { Skeleton } from "@/components/ui/skeleton"

import { PostsList } from "./posts-list"
import { PostsStats } from "./posts-stats"

export default function PostsPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-2 text-amber-600 text-xs font-medium tracking-wide uppercase">
          <Calendar className="h-3.5 w-3.5" />
          Content Queue
        </div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Scheduled Posts</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage your scheduled and published posts
        </p>
      </div>

      <Suspense
        fallback={
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-xl border bg-card p-4">
                <Skeleton className="h-3 w-16 mb-3" />
                <Skeleton className="h-7 w-10" />
              </div>
            ))}
          </div>
        }
      >
        <PostsStats />
      </Suspense>

      <Suspense
        fallback={
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        }
      >
        <PostsList />
      </Suspense>
    </div>
  )
}
