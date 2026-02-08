# CLAUDE.md

## Build & Run Commands
```bash
npm run dev           # Start dev server (Next.js)
npm run build         # prisma generate + next build
npm run lint          # ESLint
npm run format        # Prettier
npx tsc --noEmit      # Type-check without emitting
npm run db:migrate    # Prisma migrate dev
npm run db:push       # Push schema to DB (no migration)
npm run db:seed       # Seed topics + feeds from data/topics-feeds.json
npm run db:studio     # Prisma Studio GUI
npm run test          # Runs scripts/test-auto-flow.ts (end-to-end feed pipeline test)
```

## Tech Stack
- **Framework**: Next.js 16 (App Router, React 19, Turbopack)
- **Language**: TypeScript, Zod v4 for validation
- **Database**: Neon PostgreSQL via Prisma ORM (`@prisma/client`)
- **Cache/Queue**: Upstash Redis via `ioredis` — used for feed queue, rate limiting, stats caching
- **Auth**: NextAuth v5 beta (`next-auth@5.0.0-beta.30`) with JWT strategy, `@auth/prisma-adapter`
- **AI - Scoring**: NVIDIA API using `@ai-sdk/openai` (OpenAI-compatible) with model `moonshotai/kimi-k2.5` — env: `NVIDIA_API_KEY`
- **AI - Generation**: Groq API using `@ai-sdk/groq` with model `moonshotai/kimi-k2` — env: `GROQ_API_KEY`
- **AI SDK**: Vercel AI SDK (`ai` package) — `generateText()` for both scoring and generation
- **Social**: `twitter-api-v2` for Twitter OAuth + posting, LinkedIn via REST API
- **RSS**: `rss-parser` for feed fetching
- **UI**: shadcn/ui (Radix primitives), Tailwind CSS v4 (OKLCH colors), `lucide-react` icons, `sonner` toasts
- **Hosting**: Vercel (serverless)
- **Cron**: cron-job.org — external cron hitting `/api/cron/*` routes, authenticated via `CRON_SECRET`
- **Scheduling**: `date-fns` + `date-fns-tz` for timezone-aware natural scheduling

## Architecture

### Feed Pipeline (core flow)
RSS fetch → `feed-processor.ts` → Score via `feed-scorer.ts` (rule-based + LLM topic relevance) → Auto-approve/reject by thresholds → Manual review in admin → `auto-generator.ts` generates posts → `natural-scheduler.ts` schedules → `social-publisher.ts` publishes

### Scoring System
- Rule-based component: 0-45 points (content length, freshness, uniqueness checks)
- LLM topic relevance: 0-30 points via NVIDIA Kimi K2.5 (stored as `[Topic relevance: X/10]` prefix in `moderationReasoning`)
- Moderation boost: -60 to +45 points (safety flags, sales content, marketing detection)
- Auto-approve: score >= 75, topic relevance >= 7, all flags clean
- Auto-reject: topic relevance < 5, or safety flags, or score < 40

### Key Patterns
- **Server components** for pages, **"use client"** for interactive components
- **React Query** hooks centralized in `src/hooks/use-queries.ts` with a `queryKeys` object — all admin/user data fetching goes through these hooks
- **API routes**: admin routes check `auth()` session + role, cron routes use `verifyCronAuth()` + `withDatabase()` wrapper
- **Rate limiting**: `src/lib/rate-limiter.ts` manages multi-key rotation for AI APIs with Redis-backed tracking
- **Encryption**: Social account tokens encrypted at rest via `crypto-js` AES (`src/lib/encryption.ts`)

### Cron Jobs (`/api/cron/*`)
All authenticated with `CRON_SECRET` header. Key jobs:
- `master` — orchestrator that triggers other cron jobs in sequence
- `process-feeds` — fetches RSS and scores new items
- `score-feeds` — re-scores pending items
- `process-queue` — generates posts for approved items via Redis queue
- `publish-posts` — publishes scheduled posts to Twitter/LinkedIn
- `refresh-tokens` — refreshes expiring OAuth tokens
- `cleanup` — removes old processed items
- `manage` — feed health management

## Important Conventions
- DB has no `isSponsored` field — map to `isSalesContent || isMarketing`
- `data/topics-feeds.json` and `prisma/seed.ts` must stay in sync (10 topics, 100 feeds)
- Stats use client-side React Query (not server cache) so mutations can invalidate — see `useAdminFeedStats`
- shadcn/ui: no Select or Tabs component installed — use native `<select>` or custom implementations
- Tailwind v4 uses CSS custom properties in `globals.css`, not `tailwind.config`
- OpenRouter configured as fallback provider in `src/lib/ai.ts`

## Environment Variables (key ones)
`DATABASE_URL`, `REDIS_URL`, `NEXTAUTH_SECRET`, `NVIDIA_API_KEY`, `GROQ_API_KEY`, `OPENROUTER_API_KEY`, `CRON_SECRET`, `TWITTER_CLIENT_ID`, `TWITTER_CLIENT_SECRET`, `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET`
