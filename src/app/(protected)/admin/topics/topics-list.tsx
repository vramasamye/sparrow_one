"use client"

import { useState } from "react"
import { Plus, Trash2, ToggleLeft, ToggleRight, Rss, ExternalLink } from "lucide-react"
import { toast } from "sonner"
import { useQueryClient } from "@tanstack/react-query"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  useAdminTopics,
  useCreateTopic,
  useDeleteTopic,
  useCreateFeed,
  useToggleFeed,
  useDeleteFeed,
} from "@/hooks/use-queries"

interface RSSFeed {
  id: string
  name: string
  url: string
  isActive: boolean
  lastFetchedAt: string | null
}

interface Topic {
  id: string
  name: string
  slug: string
  description: string | null
  enableTwitter: boolean
  enableLinkedin: boolean
  rssFeeds: RSSFeed[]
  _count: {
    rssFeeds: number
    feeds: number
  }
}

export function TopicsList() {
  const [addTopicOpen, setAddTopicOpen] = useState(false)
  const [addFeedOpen, setAddFeedOpen] = useState(false)
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null)

  const [newTopic, setNewTopic] = useState({ name: "", description: "" })
  const [newFeed, setNewFeed] = useState({ name: "", url: "" })

  // React Query hooks
  const queryClient = useQueryClient()
  const { data: topics = [], isLoading: loading } = useAdminTopics()
  const createTopicMutation = useCreateTopic()
  const deleteTopicMutation = useDeleteTopic()
  const createFeedMutation = useCreateFeed()
  const toggleFeedMutation = useToggleFeed()
  const deleteFeedMutation = useDeleteFeed()

  const handleAddTopic = async () => {
    if (!newTopic.name.trim()) {
      toast.error("Topic name is required. Please enter a name.")
      return
    }

    await createTopicMutation.mutateAsync(newTopic)
    setNewTopic({ name: "", description: "" })
    setAddTopicOpen(false)
  }

  const handleDeleteTopic = async (topicId: string) => {
    if (!confirm("Are you sure you want to delete this topic?")) return
    await deleteTopicMutation.mutateAsync(topicId)
  }

  const handleAddFeed = async () => {
    if (!newFeed.name.trim() || !newFeed.url.trim()) {
      toast.error("Feed name and URL are required. Please fill in both fields.")
      return
    }

    if (!selectedTopicId) {
      toast.error("Please select a topic first.")
      return
    }

    await createFeedMutation.mutateAsync({
      ...newFeed,
      topicId: selectedTopicId,
    })
    setNewFeed({ name: "", url: "" })
    setAddFeedOpen(false)
    setSelectedTopicId(null)
  }

  const handleToggleFeed = async (feedId: string, isActive: boolean) => {
    await toggleFeedMutation.mutateAsync({ feedId, isActive })
  }

  const handleDeleteFeed = async (feedId: string) => {
    if (!confirm("Are you sure you want to delete this RSS feed?")) return
    await deleteFeedMutation.mutateAsync(feedId)
  }

  const handleTogglePlatform = async (
    topicId: string,
    platform: 'twitter' | 'linkedin',
    enabled: boolean
  ) => {
    try {
      const response = await fetch(`/api/admin/topics/${topicId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [platform === 'twitter' ? 'enableTwitter' : 'enableLinkedin']: enabled
        })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update platform')
      }

      toast.success(
        `${platform === 'twitter' ? 'Twitter' : 'LinkedIn'} ${enabled ? 'enabled' : 'disabled'}`
      )

      queryClient.invalidateQueries({ queryKey: ['admin-topics'] })
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update')
    }
  }

  if (loading) {
    return <div>Loading…</div>
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Topics</h2>
        <Dialog open={addTopicOpen} onOpenChange={setAddTopicOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Topic
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Topic</DialogTitle>
              <DialogDescription>
                Create a new content topic to organize RSS feeds
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="topic-name">Topic Name</Label>
                <Input
                  id="topic-name"
                  value={newTopic.name}
                  onChange={(e) =>
                    setNewTopic({ ...newTopic, name: e.target.value })
                  }
                  placeholder="e.g., Artificial Intelligence"
                  name="topic-name"
                  autoComplete="off"
                />
              </div>
              <div>
                <Label htmlFor="topic-description">Description (Optional)</Label>
                <Input
                  id="topic-description"
                  value={newTopic.description}
                  onChange={(e) =>
                    setNewTopic({ ...newTopic, description: e.target.value })
                  }
                  placeholder="Brief description of this topic…"
                  name="topic-description"
                  autoComplete="off"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddTopicOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddTopic}>Create Topic</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {topics.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          No topics yet. Create your first topic to get started.
        </div>
      ) : (
        <div className="space-y-6">
          {topics.map((topic) => (
            <div key={topic.id} className="border rounded-lg p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold">{topic.name}</h3>
                  {topic.description && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {topic.description}
                    </p>
                  )}
                  <p className="text-xs text-muted-foreground mt-2">
                    {topic._count.rssFeeds} RSS feeds • {topic._count.feeds} articles
                  </p>

                  {/* Platform toggles */}
                  <div className="flex gap-4 mt-3 pb-3 border-b">
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`twitter-${topic.id}`} className="text-sm cursor-pointer">
                        🐦 Twitter
                      </Label>
                      <Switch
                        id={`twitter-${topic.id}`}
                        checked={topic.enableTwitter ?? true}
                        onCheckedChange={(checked) =>
                          handleTogglePlatform(topic.id, 'twitter', checked)
                        }
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor={`linkedin-${topic.id}`} className="text-sm cursor-pointer">
                        💼 LinkedIn
                      </Label>
                      <Switch
                        id={`linkedin-${topic.id}`}
                        checked={topic.enableLinkedin ?? true}
                        onCheckedChange={(checked) =>
                          handleTogglePlatform(topic.id, 'linkedin', checked)
                        }
                      />
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Dialog
                    open={addFeedOpen && selectedTopicId === topic.id}
                    onOpenChange={(open) => {
                      setAddFeedOpen(open)
                      if (open) setSelectedTopicId(topic.id)
                      else setSelectedTopicId(null)
                    }}
                  >
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Rss className="mr-2 h-4 w-4" />
                        Add Feed
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add RSS Feed to {topic.name}</DialogTitle>
                        <DialogDescription>
                          Add a new RSS feed source for this topic
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="feed-name">Feed Name</Label>
                          <Input
                            id="feed-name"
                            value={newFeed.name}
                            onChange={(e) =>
                              setNewFeed({ ...newFeed, name: e.target.value })
                            }
                            placeholder="e.g., OpenAI Blog"
                            name="feed-name"
                            autoComplete="off"
                          />
                        </div>
                        <div>
                          <Label htmlFor="feed-url">RSS Feed URL</Label>
                          <Input
                            id="feed-url"
                            value={newFeed.url}
                            onChange={(e) =>
                              setNewFeed({ ...newFeed, url: e.target.value })
                            }
                            placeholder="https://example.com/feed.xml"
                            name="feed-url"
                            autoComplete="url"
                            type="url"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setAddFeedOpen(false)
                            setSelectedTopicId(null)
                          }}
                        >
                          Cancel
                        </Button>
                        <Button onClick={handleAddFeed}>Add Feed</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteTopic(topic.id)}
                    disabled={topic._count.rssFeeds > 0 || topic._count.feeds > 0}
                    aria-label="Delete topic"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>

              {topic.rssFeeds.length > 0 ? (
                <div className="mt-4 space-y-2">
                  <h4 className="text-sm font-medium text-muted-foreground">
                    RSS Feeds
                  </h4>
                  {topic.rssFeeds.map((feed) => (
                    <div
                      key={feed.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-md"
                    >
                      <div className="flex-1">
                        <p className="font-medium">{feed.name}</p>
                        <a
                          href={feed.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 max-w-full"
                          title={feed.url}
                        >
                          <span className="truncate">{feed.url}</span>
                          <ExternalLink className="h-3 w-3 flex-shrink-0" />
                        </a>
                        {feed.lastFetchedAt && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Last fetched:{" "}
                            {new Date(feed.lastFetchedAt).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleFeed(feed.id, feed.isActive)}
                          aria-label={feed.isActive ? "Deactivate feed" : "Activate feed"}
                        >
                          {feed.isActive ? (
                            <ToggleRight className="h-5 w-5 text-green-600" />
                          ) : (
                            <ToggleLeft className="h-5 w-5 text-muted-foreground" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteFeed(feed.id)}
                          aria-label="Delete feed"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground mt-4">
                  No RSS feeds yet. Click "Add Feed" to add one.
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
