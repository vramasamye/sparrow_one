import {
  ArrowRight,
  BarChart3,
  Bird,
  Calendar,
  CheckCircle2,
  Cpu,
  Linkedin,
  Rss,
  Sparkles,
  Twitter,
  Zap,
} from "lucide-react"
import Link from "next/link"

import { Button } from "@/components/ui/button"

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-[#FAFAF8]">
      {/* Navbar */}
      <header className="sticky top-0 z-50 border-b border-black/[0.06] bg-[#FAFAF8]/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1a1a1a]">
              <Bird className="h-4 w-4 text-amber-400" />
            </div>
            <span className="text-[15px] font-semibold tracking-tight text-[#1a1a1a]">
              Sparrow
            </span>
          </Link>
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="text-[13px] text-[#666] hover:text-[#1a1a1a]"
              asChild
            >
              <Link href="/login">Sign In</Link>
            </Button>
            <Button
              size="sm"
              className="rounded-lg bg-[#1a1a1a] text-[13px] font-medium text-white hover:bg-[#333] shadow-none"
              asChild
            >
              <Link href="/login">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          {/* Animated gradient blobs */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div
              className="absolute -top-1/4 left-1/4 h-[600px] w-[600px] rounded-full opacity-[0.07]"
              style={{
                background: "radial-gradient(circle, #f59e0b 0%, transparent 70%)",
                animation: "float 20s ease-in-out infinite",
              }}
            />
            <div
              className="absolute -bottom-1/4 right-1/4 h-[500px] w-[500px] rounded-full opacity-[0.05]"
              style={{
                background: "radial-gradient(circle, #3b82f6 0%, transparent 70%)",
                animation: "float 25s ease-in-out infinite reverse",
              }}
            />
          </div>

          <div className="relative mx-auto max-w-6xl px-6 pb-24 pt-20 md:pb-32 md:pt-28">
            {/* Pill badge */}
            <div className="mb-8 flex justify-center">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-200/60 bg-amber-50 px-4 py-1.5 text-[13px] font-medium text-amber-700">
                <Sparkles className="h-3.5 w-3.5" />
                AI-Powered Content Automation
              </div>
            </div>

            {/* Headline */}
            <h1 className="mx-auto max-w-3xl text-center text-[2.75rem] font-bold leading-[1.1] tracking-tight text-[#1a1a1a] sm:text-5xl md:text-[3.5rem]">
              Your social media,{" "}
              <span className="relative inline-block">
                on autopilot
                <svg
                  className="absolute -bottom-1 left-0 w-full"
                  viewBox="0 0 200 8"
                  fill="none"
                  preserveAspectRatio="none"
                >
                  <path
                    d="M1 5.5C47 2 153 2 199 5.5"
                    stroke="#f59e0b"
                    strokeWidth="3"
                    strokeLinecap="round"
                    className="opacity-40"
                  />
                </svg>
              </span>
            </h1>

            <p className="mx-auto mt-6 max-w-xl text-center text-[17px] leading-relaxed text-[#666]">
              Aggregate content from curated RSS feeds, generate engaging posts
              with AI, and publish to Twitter and LinkedIn automatically.
            </p>

            {/* CTA */}
            <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Button
                size="lg"
                className="h-12 rounded-xl bg-[#1a1a1a] px-8 text-[15px] font-medium text-white shadow-lg shadow-black/10 hover:bg-[#333]"
                asChild
              >
                <Link href="/login">
                  Start Free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                size="lg"
                variant="ghost"
                className="h-12 rounded-xl px-8 text-[15px] font-medium text-[#666] hover:text-[#1a1a1a]"
                asChild
              >
                <Link href="#how-it-works">See How It Works</Link>
              </Button>
            </div>

            {/* Floating UI Preview */}
            <div className="relative mx-auto mt-16 max-w-2xl">
              <div className="rounded-2xl border border-black/[0.06] bg-white p-1 shadow-2xl shadow-black/[0.04]">
                <div className="rounded-xl bg-gradient-to-b from-[#fafafa] to-white p-6">
                  {/* Mini dashboard preview */}
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 rounded-full bg-emerald-400" />
                      <span className="text-xs font-medium text-[#999]">Live Dashboard</span>
                    </div>
                    <span className="text-xs text-[#ccc]">sparrow.one</span>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { label: "Feeds Tracked", value: "100+", color: "bg-blue-50 text-blue-600" },
                      { label: "Posts Generated", value: "2.4K", color: "bg-amber-50 text-amber-600" },
                      { label: "Success Rate", value: "98%", color: "bg-emerald-50 text-emerald-600" },
                    ].map((stat) => (
                      <div key={stat.label} className={`rounded-lg ${stat.color} p-3`}>
                        <div className="text-lg font-bold">{stat.value}</div>
                        <div className="text-[11px] opacity-70">{stat.label}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 space-y-2">
                    {[
                      { title: "Next.js 15 Release Notes", platform: "Twitter", time: "2m ago" },
                      { title: "State of JavaScript 2025", platform: "LinkedIn", time: "5m ago" },
                    ].map((post) => (
                      <div
                        key={post.title}
                        className="flex items-center justify-between rounded-lg border border-black/[0.04] bg-white px-3 py-2"
                      >
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                          <span className="text-xs font-medium text-[#444]">{post.title}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="rounded bg-[#f5f5f5] px-1.5 py-0.5 text-[10px] font-medium text-[#888]">
                            {post.platform}
                          </span>
                          <span className="text-[10px] text-[#ccc]">{post.time}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              {/* Decorative glow */}
              <div className="absolute -inset-4 -z-10 rounded-3xl bg-gradient-to-b from-amber-100/40 via-transparent to-blue-100/20 blur-2xl" />
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="border-t border-black/[0.06] bg-white py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="text-center">
              <span className="text-[13px] font-semibold uppercase tracking-widest text-amber-600">
                How It Works
              </span>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#1a1a1a] sm:text-4xl">
                Three steps to autopilot
              </h2>
            </div>

            <div className="mt-16 grid gap-0 md:grid-cols-3">
              {[
                {
                  step: "01",
                  icon: Rss,
                  title: "Aggregate",
                  description:
                    "We monitor 100+ curated RSS feeds across 10 topics. New articles are scored for quality and relevance by AI.",
                  accent: "text-blue-500",
                  bg: "bg-blue-50",
                },
                {
                  step: "02",
                  icon: Cpu,
                  title: "Generate",
                  description:
                    "Approved articles are transformed into engaging, platform-specific posts. Twitter threads, LinkedIn insights, all AI-crafted.",
                  accent: "text-amber-500",
                  bg: "bg-amber-50",
                },
                {
                  step: "03",
                  icon: Calendar,
                  title: "Schedule",
                  description:
                    "Posts are distributed to your connected accounts at optimal times based on your timezone and preferences.",
                  accent: "text-emerald-500",
                  bg: "bg-emerald-50",
                },
              ].map((item, i) => (
                <div key={item.step} className="relative px-8 py-6 text-center md:text-left">
                  {/* Connector line */}
                  {i < 2 && (
                    <div className="absolute right-0 top-1/2 hidden h-px w-8 -translate-y-1/2 bg-gradient-to-r from-black/10 to-transparent md:block" />
                  )}
                  <div className={`mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl ${item.bg} md:mx-0`}>
                    <item.icon className={`h-5 w-5 ${item.accent}`} />
                  </div>
                  <div className="mb-1 text-[11px] font-bold uppercase tracking-widest text-[#bbb]">
                    Step {item.step}
                  </div>
                  <h3 className="text-lg font-semibold text-[#1a1a1a]">{item.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#888]">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section className="border-t border-black/[0.06] bg-[#FAFAF8] py-24">
          <div className="mx-auto max-w-6xl px-6">
            <div className="text-center">
              <span className="text-[13px] font-semibold uppercase tracking-widest text-amber-600">
                Features
              </span>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-[#1a1a1a] sm:text-4xl">
                Built for modern creators
              </h2>
              <p className="mx-auto mt-4 max-w-lg text-[15px] text-[#888]">
                Everything you need to maintain a consistent, high-quality social media presence without the manual work.
              </p>
            </div>

            <div className="mt-16 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  icon: Rss,
                  title: "100+ RSS Feeds",
                  description: "Curated content sources across 10 topics, automatically fetched and deduplicated.",
                  color: "text-orange-500",
                },
                {
                  icon: Sparkles,
                  title: "AI Content Scoring",
                  description: "Every article is scored for quality, relevance, and safety before approval.",
                  color: "text-violet-500",
                },
                {
                  icon: Zap,
                  title: "Instant Generation",
                  description: "Transform articles into platform-optimized posts in seconds with Kimi K2.",
                  color: "text-amber-500",
                },
                {
                  icon: Twitter,
                  title: "Twitter & LinkedIn",
                  description: "Publish to both platforms with format-specific content tailored to each audience.",
                  color: "text-sky-500",
                },
                {
                  icon: Calendar,
                  title: "Smart Scheduling",
                  description: "Posts go out at your preferred times, respecting quiet hours and active days.",
                  color: "text-emerald-500",
                },
                {
                  icon: BarChart3,
                  title: "Admin Dashboard",
                  description: "Full visibility into the pipeline with feed approval, queue status, and API usage.",
                  color: "text-rose-500",
                },
              ].map((feature) => (
                <div
                  key={feature.title}
                  className="group rounded-2xl border border-black/[0.06] bg-white p-6 transition-all hover:border-black/[0.1] hover:shadow-lg hover:shadow-black/[0.03]"
                >
                  <feature.icon className={`h-5 w-5 ${feature.color}`} />
                  <h3 className="mt-4 text-[15px] font-semibold text-[#1a1a1a]">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-[#888]">
                    {feature.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="border-t border-black/[0.06] bg-white py-20">
          <div className="mx-auto max-w-6xl px-6">
            <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
              {[
                { value: "100+", label: "RSS Feeds", sublabel: "Curated sources" },
                { value: "10", label: "Topics", sublabel: "Tech categories" },
                { value: "24/7", label: "Monitoring", sublabel: "Always on" },
                { value: "2", label: "Platforms", sublabel: "Twitter & LinkedIn" },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-3xl font-bold tracking-tight text-[#1a1a1a] md:text-4xl">
                    {stat.value}
                  </div>
                  <div className="mt-1 text-sm font-medium text-[#444]">{stat.label}</div>
                  <div className="text-xs text-[#aaa]">{stat.sublabel}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="border-t border-black/[0.06] bg-[#1a1a1a] py-20">
          <div className="mx-auto max-w-6xl px-6 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Ready to automate?
            </h2>
            <p className="mx-auto mt-4 max-w-md text-[15px] text-[#888]">
              Connect your accounts, pick your topics, and let Sparrow handle the rest.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Button
                size="lg"
                className="h-12 rounded-xl bg-amber-500 px-8 text-[15px] font-medium text-[#1a1a1a] shadow-lg shadow-amber-500/20 hover:bg-amber-400"
                asChild
              >
                <Link href="/login">
                  Get Started Free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="mt-6 flex items-center justify-center gap-6 text-[13px] text-[#666]">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                Free to start
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                No credit card
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                Cancel anytime
              </span>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-black/[0.06] bg-[#FAFAF8] py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 md:flex-row">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-[#1a1a1a]">
              <Bird className="h-3.5 w-3.5 text-amber-400" />
            </div>
            <span className="text-sm font-semibold text-[#1a1a1a]">Sparrow</span>
          </div>
          <div className="flex items-center gap-6 text-[13px] text-[#999]">
            <span>Built with Next.js & AI</span>
            <span className="hidden sm:inline">&middot;</span>
            <div className="flex items-center gap-3">
              <Twitter className="h-3.5 w-3.5" />
              <Linkedin className="h-3.5 w-3.5" />
            </div>
          </div>
        </div>
      </footer>

      {/* CSS animations */}
      <style>{`
        @keyframes float {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(30px, -30px) scale(1.05); }
          66% { transform: translate(-20px, 20px) scale(0.95); }
        }
      `}</style>
    </div>
  )
}
