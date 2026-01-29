import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

// Query Keys (centralized for cache management)
export const queryKeys = {
  topics: {
    all: ["topics"] as const,
    user: (userId?: string) => ["topics", "user", userId] as const,
  },
  feeds: {
    all: ["feeds"] as const,
    byStatus: (status: string) => ["feeds", "status", status] as const,
    user: (topicId?: string, page?: number) => ["feeds", "user", topicId, page] as const,
  },
  posts: {
    all: ["posts"] as const,
    byStatus: (status?: string) => ["posts", "status", status] as const,
  },
  adminTopics: {
    all: ["admin", "topics"] as const,
  },
}

// ============================================================================
// TOPICS
// ============================================================================

interface Topic {
  id: string
  name: string
  slug: string
  description: string | null
  icon: string | null
  _count: {
    rssFeeds: number
  }
  isFollowing: boolean
}

export function useTopics() {
  return useQuery({
    queryKey: queryKeys.topics.all,
    queryFn: async () => {
      const response = await fetch("/api/topics")
      if (!response.ok) throw new Error("Failed to fetch topics")
      return response.json() as Promise<Topic[]>
    },
  })
}

export function useToggleTopic() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ topicId, isFollowing }: { topicId: string; isFollowing: boolean }) => {
      const response = await fetch(`/api/topics/${topicId}/follow`, {
        method: isFollowing ? "DELETE" : "POST",
      })

      if (!response.ok) throw new Error("Failed to update topic")
      return response.json()
    },
    onSuccess: (_, { isFollowing }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.topics.all })
      toast.success(isFollowing ? "Unfollowed topic" : "Following topic")
    },
    onError: () => {
      toast.error("Failed to update topic. Please try again.")
    },
  })
}

// ============================================================================
// ADMIN FEEDS
// ============================================================================

interface Feed {
  id: string
  title: string
  url: string
  summary: string | null
  publishedAt: string | null
  status: string
  topic: { name: string }
  rssFeed: { name: string }
}

export function useAdminFeeds(status: string) {
  return useQuery({
    queryKey: queryKeys.feeds.byStatus(status),
    queryFn: async () => {
      const response = await fetch(`/api/admin/feeds?status=${status}`)
      if (!response.ok) throw new Error("Failed to fetch feeds")
      const data = await response.json()
      return data.feeds as Feed[]
    },
  })
}

export function useApproveFeed() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      feedId,
      action,
      rejectionReason,
    }: {
      feedId: string
      action: "approve" | "reject"
      rejectionReason?: string
    }) => {
      const response = await fetch(`/api/admin/feeds/${feedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, rejectionReason }),
      })

      if (!response.ok) throw new Error("Failed to update feed")
      return response.json()
    },
    onSuccess: (_, { action }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.feeds.all })
      toast.success(`Feed ${action}d successfully`)
    },
    onError: () => {
      toast.error("Failed to update feed. Please try again.")
    },
  })
}

export function useBulkApproveFeed() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ feedIds, action }: { feedIds: string[]; action: "approve" | "reject" }) => {
      const response = await fetch("/api/admin/feeds", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedIds, action }),
      })

      if (!response.ok) throw new Error(`Failed to ${action} selected feeds`)
      return response.json()
    },
    onSuccess: (data, { action }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.feeds.all })
      toast.success(`${data.count} feeds ${action}d successfully`)
    },
    onError: (_, { action }) => {
      toast.error(`Failed to ${action} selected feeds. Please try again.`)
    },
  })
}

// ============================================================================
// USER FEEDS
// ============================================================================

interface UserFeed {
  id: string
  title: string
  url: string
  summary: string | null
  imageUrl: string | null
  author: string | null
  publishedAt: string | null
  topic: {
    name: string
    slug: string
  }
  rssFeed: {
    name: string
  }
  scheduledPosts: Array<{
    id: string
    platform: "TWITTER" | "LINKEDIN"
    scheduledFor: string
    status: "SCHEDULED" | "PUBLISHING" | "PUBLISHED"
  }>
}

export function useUserFeeds(topicId?: string, page: number = 1) {
  return useQuery({
    queryKey: queryKeys.feeds.user(topicId, page),
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: "12",
      })
      if (topicId) {
        params.set("topic", topicId)
      }

      const response = await fetch(`/api/user/feeds?${params.toString()}`)
      if (!response.ok) throw new Error("Failed to fetch feeds")

      return response.json() as Promise<{
        feeds: UserFeed[]
        hasMore: boolean
      }>
    },
  })
}

// ============================================================================
// POSTS
// ============================================================================

interface ScheduledPost {
  id: string
  platform: "TWITTER" | "LINKEDIN"
  content: string
  scheduledFor: string
  status: "SCHEDULED" | "PUBLISHING" | "PUBLISHED" | "FAILED" | "CANCELLED"
  publishedAt: string | null
  platformPostId: string | null
  errorMessage: string | null
  feed: {
    title: string
    url: string
  } | null
}

export function usePosts(status?: string) {
  return useQuery({
    queryKey: queryKeys.posts.byStatus(status),
    queryFn: async () => {
      const params = new URLSearchParams()
      if (status && status !== "all") {
        params.set("status", status)
      }

      const response = await fetch(`/api/posts?${params.toString()}`)
      if (!response.ok) throw new Error("Failed to fetch posts")

      const data = await response.json()
      return data.posts as ScheduledPost[]
    },
  })
}

export function useCancelPost() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (postId: string) => {
      const response = await fetch(`/api/posts/${postId}`, {
        method: "DELETE",
      })

      if (!response.ok) throw new Error("Failed to cancel post")
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.posts.all })
      toast.success("Post cancelled")
    },
    onError: () => {
      toast.error("Failed to cancel post. Please try again.")
    },
  })
}

// ============================================================================
// ADMIN TOPICS
// ============================================================================

interface RSSFeed {
  id: string
  name: string
  url: string
  isActive: boolean
  lastFetchedAt: string | null
}

interface AdminTopic {
  id: string
  name: string
  slug: string
  description: string | null
  rssFeeds: RSSFeed[]
  _count: {
    rssFeeds: number
    feeds: number
  }
}

export function useAdminTopics() {
  return useQuery({
    queryKey: queryKeys.adminTopics.all,
    queryFn: async () => {
      const response = await fetch("/api/admin/topics")
      if (!response.ok) throw new Error("Failed to fetch topics")
      const data = await response.json()
      return data.topics as AdminTopic[]
    },
  })
}

export function useCreateTopic() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ name, description }: { name: string; description: string }) => {
      const response = await fetch("/api/admin/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to create topic")
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.adminTopics.all })
      toast.success("Topic created successfully")
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to create topic")
    },
  })
}

export function useDeleteTopic() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (topicId: string) => {
      const response = await fetch(`/api/admin/topics/${topicId}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to delete topic")
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.adminTopics.all })
      toast.success("Topic deleted successfully")
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to delete topic")
    },
  })
}

export function useCreateFeed() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      name,
      url,
      topicId,
    }: {
      name: string
      url: string
      topicId: string
    }) => {
      const response = await fetch("/api/admin/rss-feeds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, url, topicId }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Failed to create RSS feed")
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.adminTopics.all })
      toast.success("RSS feed added successfully")
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to add RSS feed")
    },
  })
}

export function useToggleFeed() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ feedId, isActive }: { feedId: string; isActive: boolean }) => {
      const response = await fetch(`/api/admin/rss-feeds/${feedId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      })

      if (!response.ok) throw new Error("Failed to toggle feed")
      return response.json()
    },
    onSuccess: (_, { isActive }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.adminTopics.all })
      toast.success(`Feed ${!isActive ? "activated" : "deactivated"}`)
    },
    onError: () => {
      toast.error("Failed to toggle feed status. Please try again.")
    },
  })
}

export function useDeleteFeed() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (feedId: string) => {
      const response = await fetch(`/api/admin/rss-feeds/${feedId}`, {
        method: "DELETE",
      })

      if (!response.ok) throw new Error("Failed to delete feed")
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.adminTopics.all })
      toast.success("RSS feed deleted successfully")
    },
    onError: () => {
      toast.error("Failed to delete RSS feed. Please try again.")
    },
  })
}
