import { Rss, FolderOpen, TrendingUp } from "lucide-react"

import { prisma } from "@/lib/prisma"

export async function TopicsStats() {
  const [topicsCount, rssCount, activeRssCount] = await Promise.all([
    prisma.topic.count(),
    prisma.rssFeed.count(),
    prisma.rssFeed.count({ where: { isActive: true } }),
  ])

  const stats = [
    {
      label: "Total Topics",
      value: topicsCount,
      icon: FolderOpen,
      description: "Content categories",
    },
    {
      label: "RSS Feeds",
      value: rssCount,
      icon: Rss,
      description: "Total feed sources",
    },
    {
      label: "Active Feeds",
      value: activeRssCount,
      icon: TrendingUp,
      description: "Currently monitored",
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-3">
      {stats.map((stat) => {
        const Icon = stat.icon
        return (
          <div
            key={stat.label}
            className="rounded-lg border bg-card p-6 text-card-foreground"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  {stat.label}
                </p>
                <p className="text-3xl font-bold">{stat.value}</p>
                <p className="text-xs text-muted-foreground">
                  {stat.description}
                </p>
              </div>
              <Icon className="h-8 w-8 text-muted-foreground" />
            </div>
          </div>
        )
      })}
    </div>
  )
}
