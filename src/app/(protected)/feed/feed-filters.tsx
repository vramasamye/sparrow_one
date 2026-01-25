"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"

interface Topic {
  id: string
  name: string
  slug: string
}

export function FeedFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [topics, setTopics] = useState<Topic[]>([])
  const [loading, setLoading] = useState(true)

  const currentTopic = searchParams.get("topic")

  useEffect(() => {
    async function fetchTopics() {
      try {
        const response = await fetch("/api/topics")
        if (response.ok) {
          const data = await response.json()
          setTopics(data.filter((t: { isFollowing: boolean }) => t.isFollowing))
        }
      } catch (error) {
        console.error("Failed to fetch topics:", error)
      } finally {
        setLoading(false)
      }
    }
    fetchTopics()
  }, [])

  function handleTopicChange(topicId: string | null) {
    const params = new URLSearchParams(searchParams.toString())
    if (topicId) {
      params.set("topic", topicId)
    } else {
      params.delete("topic")
    }
    router.push(`/feed?${params.toString()}`)
  }

  if (loading) {
    return <div className="flex gap-2">{[1, 2, 3].map((i) => <Badge key={i} variant="outline" className="h-8 w-20 animate-pulse" />)}</div>
  }

  if (topics.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        <p className="text-muted-foreground">
          No topics selected.{" "}
          <Button variant="link" className="h-auto p-0" onClick={() => router.push("/topics")}>
            Select topics
          </Button>{" "}
          to see content.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button
        variant={!currentTopic ? "default" : "outline"}
        size="sm"
        onClick={() => handleTopicChange(null)}
      >
        All Topics
      </Button>
      {topics.map((topic) => (
        <Button
          key={topic.id}
          variant={currentTopic === topic.id ? "default" : "outline"}
          size="sm"
          onClick={() => handleTopicChange(topic.id)}
        >
          {topic.name}
        </Button>
      ))}
    </div>
  )
}
