import {
  AlertCircle,
  Linkedin,
  Link2,
  Shield,
  Trash2,
  Twitter,
} from "lucide-react"
import { cache } from "react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

import { ConnectButton, DisconnectButton } from "./connect-buttons"
import { PostingPreferences } from "./posting-preferences"

// Check which OAuth providers are configured
const twitterConfigured = !!(process.env.TWITTER_CLIENT_ID && process.env.TWITTER_CLIENT_SECRET)
const linkedinConfigured = !!(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET)

const getSocialAccounts = cache(async (userId: string) => {
  return prisma.socialAccount.findMany({
    where: { userId },
    select: {
      id: true,
      platform: true,
      platformUsername: true,
      isActive: true,
      tokenExpiresAt: true,
      lastTokenRefresh: true,
    },
  })
})

const getUserRole = cache(async (userId: string) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  })
  return user?.role
})

export default async function SettingsPage() {
  const session = await auth()

  if (!session?.user?.id) {
    return null
  }

  const [socialAccounts, userRole] = await Promise.all([
    getSocialAccounts(session.user.id),
    getUserRole(session.user.id),
  ])
  const twitterAccount = socialAccounts.find((a) => a.platform === "TWITTER")
  const linkedInAccount = socialAccounts.find((a) => a.platform === "LINKEDIN")
  const isAdmin = userRole === "ADMIN"

  return (
    <div className="mx-auto max-w-3xl space-y-10 pb-16">
      {/* Profile Hero */}
      <section className="relative overflow-hidden rounded-2xl border bg-gradient-to-br from-card via-card to-muted/30 p-8">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/[0.03] via-transparent to-transparent" />
        <div className="relative flex items-start gap-6">
          <Avatar className="h-20 w-20 ring-4 ring-background shadow-lg">
            <AvatarImage src={session.user.image || undefined} alt={session.user.name || ""} />
            <AvatarFallback className="text-xl font-semibold">
              {session.user.name
                ?.split(" ")
                .map((n) => n[0])
                .join("")
                .toUpperCase() || "U"}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-1.5">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{session.user.name}</h1>
              {isAdmin && (
                <Badge variant="secondary" className="gap-1 font-medium">
                  <Shield className="h-3 w-3" />
                  Admin
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground">{session.user.email}</p>
          </div>
        </div>
      </section>

      {/* Connected Accounts */}
      <section className="space-y-4">
        <SectionHeader
          icon={<Link2 className="h-4 w-4" />}
          title="Connected Accounts"
          description="Link your social media for auto-publishing"
        />

        <div className="grid gap-3 sm:grid-cols-2">
          {/* Twitter Card */}
          <div className="group relative overflow-hidden rounded-xl border bg-card transition-all hover:shadow-md">
            <div className="absolute inset-x-0 top-0 h-1 bg-[#1DA1F2]" />
            <div className="p-5 pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#1DA1F2]/10">
                  <Twitter className="h-5 w-5 text-[#1DA1F2]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">Twitter / X</h3>
                    {twitterAccount?.isActive && (
                      <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
                    )}
                  </div>
                  {twitterAccount ? (
                    <p className="truncate text-sm text-muted-foreground">
                      @{twitterAccount.platformUsername || "Connected"}
                    </p>
                  ) : !twitterConfigured ? (
                    <p className="flex items-center gap-1 text-sm text-amber-600">
                      <AlertCircle className="h-3 w-3" />
                      Not configured
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Not connected</p>
                  )}
                </div>
              </div>
              {twitterAccount?.tokenExpiresAt && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Token expires {new Date(twitterAccount.tokenExpiresAt).toLocaleDateString()}
                </p>
              )}
              <div className="mt-4">
                {twitterAccount ? (
                  <DisconnectButton platform="twitter" accountId={twitterAccount.id} />
                ) : (
                  <ConnectButton platform="twitter" disabled={!twitterConfigured} />
                )}
              </div>
            </div>
          </div>

          {/* LinkedIn Card */}
          <div className="group relative overflow-hidden rounded-xl border bg-card transition-all hover:shadow-md">
            <div className="absolute inset-x-0 top-0 h-1 bg-[#0A66C2]" />
            <div className="p-5 pt-6">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#0A66C2]/10">
                  <Linkedin className="h-5 w-5 text-[#0A66C2]" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">LinkedIn</h3>
                    {linkedInAccount?.isActive && (
                      <span className="flex h-2 w-2 rounded-full bg-emerald-500" />
                    )}
                  </div>
                  {linkedInAccount ? (
                    <p className="truncate text-sm text-muted-foreground">
                      {linkedInAccount.platformUsername || "Connected"}
                    </p>
                  ) : !linkedinConfigured ? (
                    <p className="flex items-center gap-1 text-sm text-amber-600">
                      <AlertCircle className="h-3 w-3" />
                      Not configured
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Not connected</p>
                  )}
                </div>
              </div>
              {linkedInAccount?.tokenExpiresAt && (
                <p className="mt-3 text-xs text-muted-foreground">
                  Token expires {new Date(linkedInAccount.tokenExpiresAt).toLocaleDateString()}
                </p>
              )}
              <div className="mt-4">
                {linkedInAccount ? (
                  <DisconnectButton platform="linkedin" accountId={linkedInAccount.id} />
                ) : (
                  <ConnectButton platform="linkedin" disabled={!linkedinConfigured} />
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Posting Preferences */}
      <section className="space-y-4">
        <PostingPreferences />
      </section>

      {/* Danger Zone */}
      <section className="space-y-4">
        <SectionHeader
          icon={<Trash2 className="h-4 w-4 text-destructive" />}
          title="Danger Zone"
          description="Irreversible actions"
          variant="destructive"
        />
        <div className="rounded-xl border border-destructive/20 bg-destructive/[0.02] p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h4 className="font-medium">Delete Account</h4>
              <p className="text-sm text-muted-foreground">
                Permanently remove your account and all associated data
              </p>
            </div>
            <Button variant="destructive" size="sm" disabled>
              Delete Account
            </Button>
          </div>
        </div>
      </section>
    </div>
  )
}

function SectionHeader({
  icon,
  title,
  description,
  variant,
}: {
  icon: React.ReactNode
  title: string
  description: string
  variant?: "destructive"
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={`flex h-8 w-8 items-center justify-center rounded-lg ${
          variant === "destructive"
            ? "bg-destructive/10"
            : "bg-primary/5"
        }`}
      >
        {icon}
      </div>
      <div>
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  )
}
