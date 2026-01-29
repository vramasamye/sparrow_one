import Link from "next/link"
import { ArrowRight, Calendar, Linkedin, Play, Rss, Settings, Tags, Twitter } from "lucide-react"
import { cache } from "react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const getDashboardStats = cache(async (userId: string) => {
  const [scheduledPosts, socialAccounts, userTopics, pendingFeeds, approvedFeeds] = await Promise.all([
    prisma.scheduledPost.count({
      where: {
        userId,
        status: "SCHEDULED",
      },
    }),
    prisma.socialAccount.findMany({
      where: {
        userId,
        isActive: true,
      },
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome back, {session.user.name || "User"}! Here&apos;s an overview of your account.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scheduled Posts</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.scheduledPosts}</div>
            <p className="text-xs text-muted-foreground">Posts waiting to be published</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Topics</CardTitle>
            <Rss className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.userTopics}</div>
            <p className="text-xs text-muted-foreground">Topics you&apos;re following</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Twitter</CardTitle>
            <Twitter className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{hasTwitter ? "Connected" : "Not Connected"}</div>
            <p className="text-xs text-muted-foreground">
              {hasTwitter ? "Ready to post" : "Connect in settings"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">LinkedIn</CardTitle>
            <Linkedin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {hasLinkedIn ? "Connected" : "Not Connected"}
            </div>
            <p className="text-xs text-muted-foreground">
              {hasLinkedIn ? "Ready to post" : "Connect in settings"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Getting Started</CardTitle>
            <CardDescription>Complete these steps to start publishing</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full ${
                      stats.userTopics > 0
                        ? "bg-green-100 text-green-600"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    1
                  </div>
                  <div>
                    <p className="font-medium">Select Topics</p>
                    <p className="text-sm text-muted-foreground">
                      {stats.userTopics > 0
                        ? `Following ${stats.userTopics} topics`
                        : "Choose topics you want content from"}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/topics">
                    <Tags className="mr-2 h-4 w-4" />
                    Topics
                  </Link>
                </Button>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full ${
                      hasTwitter || hasLinkedIn
                        ? "bg-green-100 text-green-600"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    2
                  </div>
                  <div>
                    <p className="font-medium">Connect Social Accounts</p>
                    <p className="text-sm text-muted-foreground">
                      {hasTwitter && hasLinkedIn
                        ? "Twitter & LinkedIn connected"
                        : hasTwitter
                          ? "Twitter connected"
                          : hasLinkedIn
                            ? "LinkedIn connected"
                            : "Link Twitter and/or LinkedIn"}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/settings">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Link>
                </Button>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`flex h-8 w-8 items-center justify-center rounded-full ${
                      stats.scheduledPosts > 0
                        ? "bg-green-100 text-green-600"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    3
                  </div>
                  <div>
                    <p className="font-medium">Browse & Schedule Posts</p>
                    <p className="text-sm text-muted-foreground">
                      {stats.approvedFeeds > 0
                        ? `${stats.approvedFeeds} articles ready to post`
                        : "Generate AI posts from approved content"}
                    </p>
                  </div>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/feed">
                    <ArrowRight className="mr-2 h-4 w-4" />
                    Feed
                  </Link>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Admin Quick Actions */}
        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>Admin Actions</CardTitle>
              <CardDescription>Manage feeds and content</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="font-medium">Pending Feeds</p>
                  <p className="text-sm text-muted-foreground">
                    {stats.pendingFeeds} feeds awaiting approval
                  </p>
                </div>
                <Button size="sm" asChild>
                  <Link href="/admin/feeds">
                    Review
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="font-medium">Fetch New Content</p>
                  <p className="text-sm text-muted-foreground">
                    Pull latest articles from RSS feeds
                  </p>
                </div>
                <Button size="sm" variant="outline" asChild>
                  <Link href="/admin/feeds?action=fetch">
                    <Play className="mr-2 h-4 w-4" />
                    Fetch
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {!isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>Your latest publishing activity</CardDescription>
            </CardHeader>
            <CardContent>
              {stats.scheduledPosts > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm">
                    You have <strong>{stats.scheduledPosts}</strong> posts scheduled.
                  </p>
                  <Button variant="outline" size="sm" asChild>
                    <Link href="/posts">View Scheduled Posts</Link>
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No scheduled posts yet. Browse the feed to create your first post.
                </p>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
