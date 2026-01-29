import { subDays } from "date-fns"
import {
  Activity,
  BarChart3,
  CheckCircle,
  Clock,
  Rss,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react"
import { cache } from "react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { prisma } from "@/lib/prisma"

const getAnalytics = cache(async () => {
  const now = new Date()
  const sevenDaysAgo = subDays(now, 7)
  const thirtyDaysAgo = subDays(now, 30)

  const [
    totalUsers,
    newUsersLast7Days,
    totalPosts,
    postsLast7Days,
    publishedPosts,
    failedPosts,
    totalFeeds,
    pendingFeeds,
    approvedFeeds,
    rejectedFeeds,
    activeSocialAccounts,
    topicsStats,
    platformStats,
  ] = await Promise.all([
    // User stats
    prisma.user.count(),
    prisma.user.count({
      where: { createdAt: { gte: sevenDaysAgo } },
    }),

    // Post stats
    prisma.scheduledPost.count(),
    prisma.scheduledPost.count({
      where: { createdAt: { gte: sevenDaysAgo } },
    }),
    prisma.scheduledPost.count({
      where: { status: "PUBLISHED" },
    }),
    prisma.scheduledPost.count({
      where: { status: "FAILED" },
    }),

    // Feed stats
    prisma.feed.count(),
    prisma.feed.count({ where: { status: "PENDING" } }),
    prisma.feed.count({ where: { status: "APPROVED" } }),
    prisma.feed.count({ where: { status: "REJECTED" } }),

    // Social accounts
    prisma.socialAccount.count({
      where: { isActive: true },
    }),

    // Topics distribution
    prisma.topic.findMany({
      include: {
        _count: {
          select: {
            feeds: true,
            userTopics: true,
          },
        },
      },
      orderBy: {
        userTopics: {
          _count: "desc",
        },
      },
      take: 5,
    }),

    // Platform stats
    prisma.scheduledPost.groupBy({
      by: ["platform"],
      _count: true,
      where: {
        createdAt: { gte: thirtyDaysAgo },
      },
    }),
  ])

  const successRate = totalPosts > 0
    ? ((publishedPosts / (publishedPosts + failedPosts)) * 100).toFixed(1)
    : "0"

  return {
    users: {
      total: totalUsers,
      newLast7Days: newUsersLast7Days,
    },
    posts: {
      total: totalPosts,
      last7Days: postsLast7Days,
      published: publishedPosts,
      failed: failedPosts,
      successRate,
    },
    feeds: {
      total: totalFeeds,
      pending: pendingFeeds,
      approved: approvedFeeds,
      rejected: rejectedFeeds,
    },
    socialAccounts: activeSocialAccounts,
    topTopics: topicsStats,
    platformStats,
  }
})

export default async function AdminAnalyticsPage() {
  const analytics = await getAnalytics()

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
        <p className="text-muted-foreground">Platform metrics and performance insights</p>
      </div>

      {/* Overview Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.users.total}</div>
            <p className="text-xs text-muted-foreground">
              +{analytics.users.newLast7Days} in last 7 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Posts</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.posts.total}</div>
            <p className="text-xs text-muted-foreground">
              +{analytics.posts.last7Days} in last 7 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.posts.successRate}%</div>
            <p className="text-xs text-muted-foreground">
              {analytics.posts.published} published, {analytics.posts.failed} failed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Connected Accounts</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analytics.socialAccounts}</div>
            <p className="text-xs text-muted-foreground">Active social connections</p>
          </CardContent>
        </Card>
      </div>

      {/* Feed Stats */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Rss className="h-5 w-5" />
              Feed Status
            </CardTitle>
            <CardDescription>Distribution of content by status</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-yellow-500" />
                  <span>Pending</span>
                </div>
                <span className="font-bold">{analytics.feeds.pending}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-500" />
                  <span>Approved</span>
                </div>
                <span className="font-bold">{analytics.feeds.approved}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-red-500" />
                  <span>Rejected</span>
                </div>
                <span className="font-bold">{analytics.feeds.rejected}</span>
              </div>
              <div className="border-t pt-4">
                <div className="flex items-center justify-between font-medium">
                  <span>Total Content</span>
                  <span>{analytics.feeds.total}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Topics</CardTitle>
            <CardDescription>Most followed topics by users</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analytics.topTopics.map((topic, index) => (
                <div key={topic.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-muted text-xs font-medium">
                      {index + 1}
                    </span>
                    <span>{topic.name}</span>
                  </div>
                  <div className="text-right text-sm">
                    <p className="font-medium">{topic._count.userTopics} followers</p>
                    <p className="text-muted-foreground">{topic._count.feeds} items</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Platform Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Posts by Platform (Last 30 Days)</CardTitle>
          <CardDescription>Distribution of scheduled posts across platforms</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-8">
            {analytics.platformStats.map((stat) => (
              <div key={stat.platform} className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                    stat.platform === "TWITTER"
                      ? "bg-[#1DA1F2]/10 text-[#1DA1F2]"
                      : "bg-[#0A66C2]/10 text-[#0A66C2]"
                  }`}
                >
                  {stat.platform === "TWITTER" ? "X" : "in"}
                </div>
                <div>
                  <p className="text-2xl font-bold">{stat._count}</p>
                  <p className="text-sm text-muted-foreground">{stat.platform}</p>
                </div>
              </div>
            ))}
            {analytics.platformStats.length === 0 && (
              <p className="text-muted-foreground">No posts in the last 30 days</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
