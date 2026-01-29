import { Calendar, CheckCircle, Clock, XCircle } from "lucide-react"
import { cache } from "react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

const getPostsStats = cache(async (userId: string) => {
  const [scheduled, published, failed, today] = await Promise.all([
    prisma.scheduledPost.count({
      where: { userId, status: "SCHEDULED" },
    }),
    prisma.scheduledPost.count({
      where: { userId, status: "PUBLISHED" },
    }),
    prisma.scheduledPost.count({
      where: { userId, status: "FAILED" },
    }),
    prisma.scheduledPost.count({
      where: {
        userId,
        scheduledFor: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
          lt: new Date(new Date().setHours(23, 59, 59, 999)),
        },
      },
    }),
  ])

  return { scheduled, published, failed, today }
})

export async function PostsStats() {
  const session = await auth()

  if (!session?.user?.id) {
    return null
  }

  const stats = await getPostsStats(session.user.id)

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Scheduled</CardTitle>
          <Clock className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.scheduled}</div>
          <p className="text-xs text-muted-foreground">Waiting to be published</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Published</CardTitle>
          <CheckCircle className="h-4 w-4 text-green-500" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.published}</div>
          <p className="text-xs text-muted-foreground">Successfully posted</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Failed</CardTitle>
          <XCircle className="h-4 w-4 text-destructive" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.failed}</div>
          <p className="text-xs text-muted-foreground">Failed to publish</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Today</CardTitle>
          <Calendar className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.today}</div>
          <p className="text-xs text-muted-foreground">Posts for today</p>
        </CardContent>
      </Card>
    </div>
  )
}
