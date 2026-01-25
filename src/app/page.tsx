import { ArrowRight, Rss, Sparkles, Twitter } from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Rss className="h-4 w-4" />
            </div>
            <span className="text-lg font-semibold">Sparrow</span>
          </Link>
          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild>
              <Link href="/login">Sign In</Link>
            </Button>
            <Button asChild>
              <Link href="/login">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <main className="flex-1">
        <section className="container flex flex-col items-center gap-8 py-24 text-center md:py-32">
          <div className="inline-flex items-center gap-2 rounded-full border bg-muted px-4 py-1.5 text-sm">
            <Sparkles className="h-4 w-4" />
            <span>AI-Powered Social Media Publishing</span>
          </div>

          <h1 className="max-w-4xl text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl">
            Automate Your Social Media with{" "}
            <span className="text-primary">AI Intelligence</span>
          </h1>

          <p className="max-w-2xl text-lg text-muted-foreground md:text-xl">
            Aggregate content from 80+ RSS feeds across 16 topics, generate engaging posts with AI,
            and publish to Twitter and LinkedIn automatically.
          </p>

          <div className="flex flex-col gap-4 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/login">
                Start Free <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="#features">Learn More</Link>
            </Button>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="border-t bg-muted/50 py-24">
          <div className="container">
            <div className="text-center">
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Everything You Need
              </h2>
              <p className="mt-4 text-lg text-muted-foreground">
                Powerful features to supercharge your social media presence
              </p>
            </div>

            <div className="mt-16 grid gap-8 md:grid-cols-3">
              <div className="rounded-lg border bg-background p-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Rss className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mt-4 text-xl font-semibold">80+ RSS Feeds</h3>
                <p className="mt-2 text-muted-foreground">
                  Curated content from top sources across 16 technology topics, automatically
                  aggregated and deduplicated.
                </p>
              </div>

              <div className="rounded-lg border bg-background p-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mt-4 text-xl font-semibold">AI Generation</h3>
                <p className="mt-2 text-muted-foreground">
                  Transform articles into engaging social posts with AI. Platform-specific
                  formatting for Twitter and LinkedIn.
                </p>
              </div>

              <div className="rounded-lg border bg-background p-8">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                  <Twitter className="h-6 w-6 text-primary" />
                </div>
                <h3 className="mt-4 text-xl font-semibold">Smart Scheduling</h3>
                <p className="mt-2 text-muted-foreground">
                  Automatically schedule 6 posts per day at optimal times. Token refresh and retry
                  logic built-in.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container flex flex-col items-center justify-between gap-4 md:flex-row">
          <div className="flex items-center gap-2">
            <Rss className="h-5 w-5" />
            <span className="font-semibold">Sparrow</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Built with Next.js, Prisma, and AI
          </p>
        </div>
      </footer>
    </div>
  )
}
