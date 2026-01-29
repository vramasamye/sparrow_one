import { Suspense } from "react"

import { PostsList } from "./posts-list"
import { PostsStats } from "./posts-stats"

export default function PostsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Scheduled Posts</h1>
        <p className="text-muted-foreground">
          Manage your scheduled and published posts
        </p>
      </div>

      <Suspense fallback={<div>Loading stats…</div>}>
        <PostsStats />
      </Suspense>

      <Suspense fallback={<div>Loading posts…</div>}>
        <PostsList />
      </Suspense>
    </div>
  )
}
