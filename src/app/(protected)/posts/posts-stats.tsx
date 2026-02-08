import { Calendar, CheckCircle, Clock, XCircle } from "lucide-react"
import { cache } from "react"

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

  const items = [
    {
      label: "Scheduled",
      value: stats.scheduled,
      icon: Clock,
      accent: "text-blue-500",
      bg: "bg-blue-500/10",
      border: "border-l-blue-400",
    },
    {
      label: "Published",
      value: stats.published,
      icon: CheckCircle,
      accent: "text-emerald-500",
      bg: "bg-emerald-500/10",
      border: "border-l-emerald-400",
    },
    {
      label: "Failed",
      value: stats.failed,
      icon: XCircle,
      accent: "text-red-400",
      bg: "bg-red-500/10",
      border: "border-l-red-400",
    },
    {
      label: "Today",
      value: stats.today,
      icon: Calendar,
      accent: "text-amber-500",
      bg: "bg-amber-500/10",
      border: "border-l-amber-400",
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map((item) => (
        <div
          key={item.label}
          className={`relative overflow-hidden rounded-xl border border-l-[3px] ${item.border} bg-card p-4 transition-shadow hover:shadow-md`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
            <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${item.bg}`}>
              <item.icon className={`h-3.5 w-3.5 ${item.accent}`} />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold tracking-tight">{item.value}</div>
        </div>
      ))}
    </div>
  )
}
