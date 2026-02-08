"use client"

import { useState, useEffect } from "react"
import { Clock, Globe, Linkedin, Moon, RotateCcw, Save, Twitter } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
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
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6]

function formatHour(hour: number): string {
  if (hour === 0) return "12a"
  if (hour === 12) return "12p"
  return hour < 12 ? `${hour}a` : `${hour - 12}p`
}

function formatHourFull(hour: number): string {
  if (hour === 0) return "12:00 AM"
  if (hour === 12) return "12:00 PM"
  return hour < 12 ? `${hour}:00 AM` : `${hour - 12}:00 PM`
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
  const [quietStart, setQuietStart] = useState<number | null>(null)
  const [quietEnd, setQuietEnd] = useState<number | null>(null)

  // Sync from server data
  useEffect(() => {
    if (preferences) {
      setTimezone(preferences.timezone)
      setActiveDays(preferences.activeDays)
      setTwitterTimes(preferences.twitterTimes)
      setLinkedinTimes(preferences.linkedinTimes)
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
      quietStart,
      quietEnd,
    })
  }

  function handleReset() {
    resetMutation.mutate()
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/5">
            <Clock className="h-4 w-4" />
          </div>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Posting Schedule</h2>
            <p className="text-sm text-muted-foreground">Loading preferences...</p>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-8">
          <div className="flex items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Section Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/5">
          <Clock className="h-4 w-4" />
        </div>
        <div>
          <h2 className="text-lg font-semibold tracking-tight">Posting Schedule</h2>
          <p className="text-sm text-muted-foreground">Configure when your posts go out</p>
        </div>
      </div>

      <div className="rounded-xl border bg-card">
        {/* Timezone */}
        <div className="p-5">
          <Label className="flex items-center gap-2 text-sm font-medium">
            <Globe className="h-4 w-4 text-muted-foreground" />
            Timezone
          </Label>
          <select
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
            className="mt-2 w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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

        <div className="border-t" />

        {/* Active Days */}
        <div className="p-5">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Active Days</Label>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Weekends</span>
              <Switch
                checked={includesWeekends}
                onCheckedChange={toggleWeekends}
              />
            </div>
          </div>
          <div className="mt-3 flex gap-1.5">
            {DAY_LABELS.map((label, i) => (
              <button
                key={i}
                onClick={() => toggleDay(i)}
                className={`flex-1 rounded-lg py-2.5 text-center text-sm font-medium transition-all ${
                  activeDays.includes(i)
                    ? "bg-foreground text-background shadow-sm"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t" />

        {/* Twitter Posting Times */}
        <div className="p-5">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Twitter className="h-4 w-4 text-[#1DA1F2]" />
              Twitter Times
            </Label>
            <Badge variant="outline" className="font-mono text-xs">
              {twitterTimes.length} slots
            </Badge>
          </div>
          <div className="mt-3 grid grid-cols-8 gap-1">
            {Array.from({ length: 24 }, (_, i) => (
              <button
                key={i}
                onClick={() => toggleHour("twitter", i)}
                className={`rounded-lg py-2 text-center text-xs font-medium transition-all ${
                  twitterTimes.includes(i)
                    ? "bg-[#1DA1F2] text-white shadow-sm shadow-[#1DA1F2]/25"
                    : "bg-muted/40 text-muted-foreground hover:bg-muted"
                }`}
              >
                {formatHour(i)}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t" />

        {/* LinkedIn Posting Times */}
        <div className="p-5">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Linkedin className="h-4 w-4 text-[#0A66C2]" />
              LinkedIn Times
            </Label>
            <Badge variant="outline" className="font-mono text-xs">
              {linkedinTimes.length} slots
            </Badge>
          </div>
          <div className="mt-3 grid grid-cols-8 gap-1">
            {Array.from({ length: 24 }, (_, i) => (
              <button
                key={i}
                onClick={() => toggleHour("linkedin", i)}
                className={`rounded-lg py-2 text-center text-xs font-medium transition-all ${
                  linkedinTimes.includes(i)
                    ? "bg-[#0A66C2] text-white shadow-sm shadow-[#0A66C2]/25"
                    : "bg-muted/40 text-muted-foreground hover:bg-muted"
                }`}
              >
                {formatHour(i)}
              </button>
            ))}
          </div>
        </div>

        <div className="border-t" />

        {/* Quiet Hours */}
        <div className="p-5">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-2 text-sm font-medium">
              <Moon className="h-4 w-4 text-muted-foreground" />
              Quiet Hours
            </Label>
            <Switch
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
          {quietStart !== null && (
            <div className="mt-3 flex items-center gap-3">
              <select
                value={quietStart}
                onChange={(e) => setQuietStart(Number(e.target.value))}
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>
                    {formatHourFull(i)}
                  </option>
                ))}
              </select>
              <span className="text-sm text-muted-foreground">to</span>
              <select
                value={quietEnd ?? 7}
                onChange={(e) => setQuietEnd(Number(e.target.value))}
                className="rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {Array.from({ length: 24 }, (_, i) => (
                  <option key={i} value={i}>
                    {formatHourFull(i)}
                  </option>
                ))}
              </select>
            </div>
          )}
          <p className="mt-2 text-xs text-muted-foreground">
            {quietStart !== null
              ? `No posts between ${formatHourFull(quietStart)} and ${formatHourFull(quietEnd ?? 7)}`
              : "All hours available for posting"}
          </p>
        </div>

        <div className="border-t" />

        {/* Actions */}
        <div className="flex items-center justify-between bg-muted/20 p-4">
          <button
            onClick={handleReset}
            disabled={resetMutation.isPending}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset defaults
          </button>
          <Button
            onClick={handleSave}
            disabled={updateMutation.isPending || !hasChanges}
            size="sm"
            className="gap-2"
          >
            <Save className="h-3.5 w-3.5" />
            {updateMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>
    </div>
  )
}
