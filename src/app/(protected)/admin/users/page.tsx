import { format } from "date-fns"
import { MoreVertical, Shield, User } from "lucide-react"
import { cache } from "react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { prisma } from "@/lib/prisma"

const getUsers = cache(async () => {
  return prisma.user.findMany({
    include: {
      _count: {
        select: {
          scheduledPosts: true,
          userTopics: true,
          socialAccounts: true,
        },
      },
      socialAccounts: {
        select: {
          platform: true,
          isActive: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  })
})

const getUserStats = cache(async () => {
  const [totalUsers, activeUsers, admins] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({
      where: {
        socialAccounts: {
          some: { isActive: true },
        },
      },
    }),
    prisma.user.count({
      where: { role: "ADMIN" },
    }),
  ])

  return { totalUsers, activeUsers, admins }
})

export default async function AdminUsersPage() {
  const [users, stats] = await Promise.all([getUsers(), getUserStats()])

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Users</h1>
        <p className="text-muted-foreground">Manage platform users and permissions</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <User className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalUsers}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Users</CardTitle>
            <User className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.activeUsers}</div>
            <p className="text-xs text-muted-foreground">With connected accounts</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Admins</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.admins}</div>
          </CardContent>
        </Card>
      </div>

      {/* Users List */}
      <Card>
        <CardHeader>
          <CardTitle>All Users</CardTitle>
          <CardDescription>View and manage all registered users</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {users.map((user) => (
              <div
                key={user.id}
                className="flex items-center justify-between rounded-lg border p-4"
              >
                <div className="flex items-center gap-4">
                  <Avatar>
                    <AvatarImage src={user.image || undefined} alt={user.name || ""} />
                    <AvatarFallback>
                      {user.name
                        ?.split(" ")
                        .map((n) => n[0])
                        .join("")
                        .toUpperCase() || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{user.name || "Unnamed User"}</h4>
                      {user.role === "ADMIN" && (
                        <Badge variant="secondary">Admin</Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right text-sm">
                    <p>{user._count.scheduledPosts} posts</p>
                    <p className="text-muted-foreground">{user._count.userTopics} topics</p>
                  </div>
                  <div className="flex gap-1">
                    {user.socialAccounts.map((account) => (
                      <Badge
                        key={account.platform}
                        variant={account.isActive ? "default" : "secondary"}
                        className="text-xs"
                      >
                        {account.platform}
                      </Badge>
                    ))}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Joined {format(new Date(user.createdAt), "PP")}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" aria-label="User options">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>View Details</DropdownMenuItem>
                      <DropdownMenuItem>View Posts</DropdownMenuItem>
                      {user.role !== "ADMIN" && (
                        <DropdownMenuItem>Make Admin</DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            ))}

            {users.length === 0 && (
              <p className="py-8 text-center text-muted-foreground">No users yet</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
