import Link from "next/link"
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  Linkedin,
  Newspaper,
  Rss,
  Settings,
  Sparkles,
  Tags,
  Twitter,
  Zap,
} from "lucide-react"
import { cache } from "react"

import { Button } from "@/components/ui/button"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const getDashboardStats = cache(async (userId: string) => {
  const [scheduledPosts, publishedPosts, socialAccounts, userTopics, pendingFeeds, approvedFeeds] =
    await Promise.all([
      prisma.scheduledPost.count({
        where: { userId, status: "SCHEDULED" },
      }),
      prisma.scheduledPost.count({
        where: { userId, status: "PUBLISHED" },
      }),
      prisma.socialAccount.findMany({
        where: { userId, isActive: true },
      }),
      prisma.userTopic.count({
        where: { userId },
      }),
      prisma.feed.count({
        where: { status: "PENDING" },
      }),
      prisma.feed.count({
        where: { status: "APPROVED" },
      }),
    ])

  return {
    scheduledPosts,
    publishedPosts,
    socialAccounts,
    userTopics,
    pendingFeeds,
    approvedFeeds,
  }
})

const getUserRole = cache(async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  })
  return user?.role
})

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

export default async function DashboardPage() {
  const session = await auth()

  if (!session?.user?.id) {
    return null
  }

  const [stats, userRole] = await Promise.all([
    getDashboardStats(session.user.id),
    getUserRole(session.user.id),
  ])

  const hasTwitter = stats.socialAccounts.some((a) => a.platform === "TWITTER")
  const hasLinkedIn = stats.socialAccounts.some((a) => a.platform === "LINKEDIN")
  const isAdmin = userRole === "ADMIN"

  const firstName = session.user.name?.split(" ")[0] || "there"

  // Setup progress
  const steps = [
    { done: stats.userTopics > 0, label: "Topics" },
    { done: hasTwitter || hasLinkedIn, label: "Accounts" },
    { done: stats.scheduledPosts > 0 || stats.publishedPosts > 0, label: "Posts" },
  ]
  const completedSteps = steps.filter((s) => s.done).length
  const allDone = completedSteps === steps.length

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Greeting Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-stone-900 via-stone-800 to-stone-900 px-8 py-10 text-white">
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }} />
        <div className="relative">
          <div className="flex items-center gap-2 text-amber-400/80 text-sm font-medium tracking-wide uppercase">
            <Sparkles className="h-3.5 w-3.5" />
            Dashboard
          </div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight">
            {getGreeting()}, {firstName}
          </h1>
          <p className="mt-2 text-stone-300 max-w-lg">
            {allDone
              ? "Your autopilot is running. Content is being curated and published for you."
              : "Let's get your content pipeline set up. A few steps and you're live."}
          </p>
        </div>
      </div>

      {/* Setup Progress (only show if not all done) */}
      {!allDone && (
        <div className="rounded-2xl border-2 border-dashed border-amber-200 bg-amber-50/50 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Zap className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-semibold text-amber-900">Setup Progress</span>
            <span className="ml-auto text-xs font-mono text-amber-600">{completedSteps}/{steps.length}</span>
          </div>

          <div className="flex gap-2 mb-6">
            {steps.map((step, i) => (
              <div key={i} className="flex-1">
                <div className={`h-1.5 rounded-full transition-all ${step.done ? "bg-amber-500" : "bg-amber-200"}`} />
                <div className={`mt-1.5 text-[11px] font-medium ${step.done ? "text-amber-700" : "text-amber-400"}`}>
                  {step.label}
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            {/* Step 1: Topics */}
            <div className={`flex items-center gap-4 rounded-xl border p-4 transition-colors ${stats.userTopics > 0 ? "border-emerald-200 bg-emerald-50/50" : "border-border bg-card hover:border-amber-300"}`}>
              <div className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${stats.userTopics > 0 ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"}`}>
                {stats.userTopics > 0 ? <CheckCircle2 className="h-4 w-4" /> : "1"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">Select your topics</p>
                <p className="text-xs text-muted-foreground">
                  {stats.userTopics > 0 ? `Following ${stats.userTopics} topics` : "Choose what content to curate"}
                </p>
              </div>
              <Button variant="ghost" size="sm" className="shrink-0" asChild>
                <Link href="/topics">
                  <Tags className="mr-1.5 h-3.5 w-3.5" />
                  {stats.userTopics > 0 ? "Manage" : "Choose"}
                </Link>
              </Button>
            </div>

            {/* Step 2: Social Accounts */}
            <div className={`flex items-center gap-4 rounded-xl border p-4 transition-colors ${hasTwitter || hasLinkedIn ? "border-emerald-200 bg-emerald-50/50" : "border-border bg-card hover:border-amber-300"}`}>
              <div className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${hasTwitter || hasLinkedIn ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"}`}>
                {hasTwitter || hasLinkedIn ? <CheckCircle2 className="h-4 w-4" /> : "2"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">Connect social accounts</p>
                <p className="text-xs text-muted-foreground">
                  {hasTwitter && hasLinkedIn
                    ? "Twitter & LinkedIn connected"
                    : hasTwitter
                      ? "Twitter connected"
                      : hasLinkedIn
                        ? "LinkedIn connected"
                        : "Link Twitter and/or LinkedIn"}
                </p>
              </div>
              <Button variant="ghost" size="sm" className="shrink-0" asChild>
                <Link href="/settings">
                  <Settings className="mr-1.5 h-3.5 w-3.5" />
                  Settings
                </Link>
              </Button>
            </div>

            {/* Step 3: Posts */}
            <div className={`flex items-center gap-4 rounded-xl border p-4 transition-colors ${stats.scheduledPosts > 0 || stats.publishedPosts > 0 ? "border-emerald-200 bg-emerald-50/50" : "border-border bg-card hover:border-amber-300"}`}>
              <div className={`flex h-9 w-9 items-center justify-center rounded-full text-sm font-bold ${stats.scheduledPosts > 0 || stats.publishedPosts > 0 ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"}`}>
                {stats.scheduledPosts > 0 || stats.publishedPosts > 0 ? <CheckCircle2 className="h-4 w-4" /> : "3"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">Browse & schedule posts</p>
                <p className="text-xs text-muted-foreground">
                  {stats.approvedFeeds > 0
                    ? `${stats.approvedFeeds} articles ready`
                    : "Generate AI posts from curated content"}
                </p>
              </div>
              <Button variant="ghost" size="sm" className="shrink-0" asChild>
                <Link href="/feed">
                  <ArrowRight className="mr-1.5 h-3.5 w-3.5" />
                  Feed
                </Link>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="relative overflow-hidden rounded-xl border border-l-[3px] border-l-blue-400 bg-card p-4 transition-shadow hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Scheduled</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/10">
              <Calendar className="h-3.5 w-3.5 text-blue-500" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight">{stats.scheduledPosts}</div>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-l-[3px] border-l-emerald-400 bg-card p-4 transition-shadow hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Published</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/10">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight">{stats.publishedPosts}</div>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-l-[3px] border-l-purple-400 bg-card p-4 transition-shadow hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Topics</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-purple-500/10">
              <Tags className="h-3.5 w-3.5 text-purple-500" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight">{stats.userTopics}</div>
        </div>

        <div className="relative overflow-hidden rounded-xl border border-l-[3px] border-l-amber-400 bg-card p-4 transition-shadow hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Content Ready</span>
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10">
              <Newspaper className="h-3.5 w-3.5 text-amber-500" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight">{stats.approvedFeeds}</div>
        </div>
      </div>

      {/* Connected Platforms + Quick Actions */}
      <div className="grid gap-4 sm:grid-cols-2">
        {/* Platforms Card */}
        <div className="rounded-2xl border bg-card p-6">
          <h3 className="text-sm font-semibold text-foreground">Connected Platforms</h3>
          <div className="mt-4 space-y-3">
            <div className={`flex items-center gap-3 rounded-xl border p-3.5 transition-colors ${hasTwitter ? "border-sky-200 bg-sky-50/50" : "border-dashed"}`}>
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${hasTwitter ? "bg-sky-500 text-white" : "bg-muted text-muted-foreground"}`}>
                <Twitter className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Twitter / X</p>
                <p className="text-xs text-muted-foreground">
                  {hasTwitter ? "Ready to post" : "Not connected"}
                </p>
              </div>
              {hasTwitter ? (
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
              ) : (
                <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                  <Link href="/settings">Connect</Link>
                </Button>
              )}
            </div>

            <div className={`flex items-center gap-3 rounded-xl border p-3.5 transition-colors ${hasLinkedIn ? "border-blue-200 bg-blue-50/50" : "border-dashed"}`}>
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${hasLinkedIn ? "bg-[#0A66C2] text-white" : "bg-muted text-muted-foreground"}`}>
                <Linkedin className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">LinkedIn</p>
                <p className="text-xs text-muted-foreground">
                  {hasLinkedIn ? "Ready to post" : "Not connected"}
                </p>
              </div>
              {hasLinkedIn ? (
                <div className="h-2 w-2 rounded-full bg-emerald-500" />
              ) : (
                <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                  <Link href="/settings">Connect</Link>
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="rounded-2xl border bg-card p-6">
          <h3 className="text-sm font-semibold text-foreground">Quick Actions</h3>
          <div className="mt-4 space-y-2">
            <Link
              href="/feed"
              className="group flex items-center gap-3 rounded-xl border p-3.5 transition-all hover:border-amber-300 hover:bg-amber-50/50 hover:shadow-sm"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600 transition-colors group-hover:bg-amber-500 group-hover:text-white">
                <Newspaper className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Browse Feed</p>
                <p className="text-xs text-muted-foreground">View curated articles</p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>

            <Link
              href="/posts"
              className="group flex items-center gap-3 rounded-xl border p-3.5 transition-all hover:border-blue-300 hover:bg-blue-50/50 hover:shadow-sm"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600 transition-colors group-hover:bg-blue-500 group-hover:text-white">
                <Calendar className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium">Scheduled Posts</p>
                <p className="text-xs text-muted-foreground">
                  {stats.scheduledPosts > 0
                    ? `${stats.scheduledPosts} posts queued`
                    : "Manage your queue"}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>

            {isAdmin && (
              <Link
                href="/admin/feeds"
                className="group flex items-center gap-3 rounded-xl border p-3.5 transition-all hover:border-purple-300 hover:bg-purple-50/50 hover:shadow-sm"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600 transition-colors group-hover:bg-purple-500 group-hover:text-white">
                  <Rss className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Feed Approval</p>
                  <p className="text-xs text-muted-foreground">
                    {stats.pendingFeeds > 0
                      ? `${stats.pendingFeeds} pending review`
                      : "All caught up"}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
