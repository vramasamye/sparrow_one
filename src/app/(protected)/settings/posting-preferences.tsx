"use client"

import { useState, useEffect } from "react"
import { Clock, Globe, RotateCcw, Save } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import {
  useUserPreferences,
  useUpdatePreferences,
  useResetPreferences,
} from "@/hooks/use-queries"

const TIMEZONES = [
  { group: "Americas", zones: [
    { value: "America/New_York", label: "Eastern Time (New York)" },
    { value: "America/Chicago", label: "Central Time (Chicago)" },
    { value: "America/Denver", label: "Mountain Time (Denver)" },
    { value: "America/Los_Angeles", label: "Pacific Time (Los Angeles)" },
    { value: "America/Anchorage", label: "Alaska (Anchorage)" },
    { value: "Pacific/Honolulu", label: "Hawaii (Honolulu)" },
    { value: "America/Toronto", label: "Toronto" },
    { value: "America/Sao_Paulo", label: "Sao Paulo" },
  ]},
  { group: "Europe", zones: [
    { value: "Europe/London", label: "London (GMT)" },
    { value: "Europe/Paris", label: "Paris (CET)" },
    { value: "Europe/Berlin", label: "Berlin (CET)" },
    { value: "Europe/Moscow", label: "Moscow" },
  ]},
  { group: "Asia / Pacific", zones: [
    { value: "Asia/Dubai", label: "Dubai (GST)" },
    { value: "Asia/Kolkata", label: "India (IST)" },
    { value: "Asia/Singapore", label: "Singapore" },
    { value: "Asia/Shanghai", label: "China (CST)" },
    { value: "Asia/Tokyo", label: "Japan (JST)" },
    { value: "Australia/Sydney", label: "Sydney (AEST)" },
  ]},
  { group: "Other", zones: [
    { value: "UTC", label: "UTC" },
  ]},
]

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
const WEEKDAYS = [1, 2, 3, 4, 5]
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]

function formatHour(hour: number): string {
  if (hour === 0) return "12am"
  if (hour === 12) return "12pm"
  return hour < 12 ? `${hour}am` : `${hour - 12}pm`
}

export function PostingPreferences() {
  const { data: preferences, isLoading } = useUserPreferences()
  const updateMutation = useUpdatePreferences()
  const resetMutation = useResetPreferences()

  // Local form state
  const [timezone, setTimezone] = useState("UTC")
  const [activeDays, setActiveDays] = useState<number[]>(ALL_DAYS)
  const [twitterTimes, setTwitterTimes] = useState<number[]>([8, 10, 12, 14, 17, 19])
  const [linkedinTimes, setLinkedinTimes] = useState<number[]>([9, 11, 13, 16, 18, 20])
  const [postsPerWeek, setPostsPerWeek] = useState(7)
  const [quietStart, setQuietStart] = useState<number | null>(null)
  const [quietEnd, setQuietEnd] = useState<number | null>(null)

  // Sync from server data
  useEffect(() => {
    if (preferences) {
      setTimezone(preferences.timezone)
      setActiveDays(preferences.activeDays)
      setTwitterTimes(preferences.twitterTimes)
      setLinkedinTimes(preferences.linkedinTimes)
      setPostsPerWeek(preferences.postsPerWeek)
      setQuietStart(preferences.quietStart)
      setQuietEnd(preferences.quietEnd)
    }
  }, [preferences])

  const hasChanges =
    preferences &&
    (timezone !== preferences.timezone ||
      JSON.stringify(activeDays.sort()) !== JSON.stringify([...preferences.activeDays].sort()) ||
      JSON.stringify(twitterTimes.sort()) !== JSON.stringify([...preferences.twitterTimes].sort()) ||
      JSON.stringify(linkedinTimes.sort()) !== JSON.stringify([...preferences.linkedinTimes].sort()) ||
      postsPerWeek !== preferences.postsPerWeek ||
      quietStart !== preferences.quietStart ||
      quietEnd !== preferences.quietEnd)

  function toggleDay(day: number) {
    setActiveDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    )
  }

  function toggleHour(platform: "twitter" | "linkedin", hour: number) {
    const setter = platform === "twitter" ? setTwitterTimes : setLinkedinTimes
    setter((prev) =>
      prev.includes(hour) ? prev.filter((h) => h !== hour) : [...prev, hour]
    )
  }

  const includesWeekends = activeDays.includes(0) && activeDays.includes(6)

  function toggleWeekends() {
    if (includesWeekends) {
      setActiveDays((prev) => prev.filter((d) => d !== 0 && d !== 6))
    } else {
      setActiveDays((prev) => [...new Set([...prev, 0, 6])])
    }
  }

  function handleSave() {
    updateMutation.mutate({
      timezone,
      activeDays,
      twitterTimes,
      linkedinTimes,
      postsPerWeek,
      quietStart,
      quietEnd,
    })
  }

  function handleReset() {
    resetMutation.mutate()
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Posting Preferences</CardTitle>
          <CardDescription>Loading your preferences...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-40 flex items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Posting Preferences
        </CardTitle>
        <CardDescription>
          Configure how your posts are scheduled and published
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Timezone */}
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Timezone
          </Label>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {TIMEZONES.map((group) => (
              <optgroup key={group.group} label={group.group}>
                {group.zones.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>

        <Separator />

        {/* Active Days */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Active Posting Days</Label>
            <div className="flex items-center gap-2">
              <Label htmlFor="weekends-toggle" className="text-sm text-muted-foreground">
                Include weekends
              </Label>
              <Switch
                id="weekends-toggle"
                checked={includesWeekends}
                onCheckedChange={toggleWeekends}
              />
            </div>
          </div>
          <div className="flex gap-2">
            {DAY_LABELS.map((label, i) => (
              <button
                key={i}
                onClick={() => toggleDay(i)}
                className={`flex-1 rounded-md border px-2 py-2 text-center text-sm font-medium transition-colors ${
                  activeDays.includes(i)
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background text-muted-foreground hover:bg-accent"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <Separator />

        {/* Twitter Posting Times */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Twitter Posting Times</Label>
            <Badge variant="outline">{twitterTimes.length} selected</Badge>
          </div>
          <div className="grid grid-cols-6 gap-1.5">
            {Array.from({ length: 24 }, (_, i) => (
              <button
                key={i}
                onClick={() => toggleHour("twitter", i)}
                className={`rounded-md border px-1 py-1.5 text-center text-xs font-medium transition-colors ${
                  twitterTimes.includes(i)
                    ? "border-[#1DA1F2] bg-[#1DA1F2]/10 text-[#1DA1F2]"
                    : "border-input bg-background text-muted-foreground hover:bg-accent"
                }`}
              >
                {formatHour(i)}
              </button>
            ))}
          </div>
        </div>

        <Separator />

        {/* LinkedIn Posting Times */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>LinkedIn Posting Times</Label>
            <Badge variant="outline">{linkedinTimes.length} selected</Badge>
          </div>
          <div className="grid grid-cols-6 gap-1.5">
            {Array.from({ length: 24 }, (_, i) => (
              <button
                key={i}
                onClick={() => toggleHour("linkedin", i)}
                className={`rounded-md border px-1 py-1.5 text-center text-xs font-medium transition-colors ${
                  linkedinTimes.includes(i)
                    ? "border-[#0A66C2] bg-[#0A66C2]/10 text-[#0A66C2]"
                    : "border-input bg-background text-muted-foreground hover:bg-accent"
                }`}
              >
                {formatHour(i)}
              </button>
            ))}
          </div>
        </div>

        <Separator />

        {/* Posts Per Week */}
        <div className="space-y-3">
          <Label>Posts Per Week</Label>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setPostsPerWeek(Math.max(1, postsPerWeek - 1))}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background text-sm font-medium hover:bg-accent"
            >
              -
            </button>
            <span className="w-12 text-center text-lg font-semibold">{postsPerWeek}</span>
            <button
              onClick={() => setPostsPerWeek(Math.min(14, postsPerWeek + 1))}
              className="flex h-9 w-9 items-center justify-center rounded-md border border-input bg-background text-sm font-medium hover:bg-accent"
            >
              +
            </button>
            <span className="text-sm text-muted-foreground">per platform (1-14)</span>
          </div>
        </div>

        <Separator />

        {/* Quiet Hours */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Quiet Hours</Label>
            <div className="flex items-center gap-2">
              <Label htmlFor="quiet-toggle" className="text-sm text-muted-foreground">
                Enable quiet hours
              </Label>
              <Switch
                id="quiet-toggle"
                checked={quietStart !== null}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setQuietStart(22)
                    setQuietEnd(7)
                  } else {
                    setQuietStart(null)
                    setQuietEnd(null)
                  }
                }}
              />
            </div>
          </div>
          {quietStart !== null && (
            <div className="flex items-center gap-3">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">From</span>
                <select
                  value={quietStart}
                  onChange={(e) => setQuietStart(Number(e.target.value))}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>
                      {formatHour(i)}
                    </option>
                  ))}
                </select>
              </div>
              <span className="mt-4 text-muted-foreground">to</span>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Until</span>
                <select
                  value={quietEnd ?? 7}
                  onChange={(e) => setQuietEnd(Number(e.target.value))}
                  className="rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {Array.from({ length: 24 }, (_, i) => (
                    <option key={i} value={i}>
                      {formatHour(i)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            {quietStart !== null
              ? `No posts will be scheduled between ${formatHour(quietStart)} and ${formatHour(quietEnd ?? 7)}`
              : "All hours are available for posting"}
          </p>
        </div>

        <Separator />

        {/* Actions */}
        <div className="flex items-center justify-between">
          <button
            onClick={handleReset}
            disabled={resetMutation.isPending}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset to defaults
          </button>
          <Button
            onClick={handleSave}
            disabled={updateMutation.isPending || !hasChanges}
            className="gap-2"
          >
            <Save className="h-4 w-4" />
            {updateMutation.isPending ? "Saving..." : "Save Preferences"}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
