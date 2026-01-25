import { AlertCircle, Linkedin, Shield, Twitter, User } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"

import { ConnectButton, DisconnectButton } from "./connect-buttons"

// Check which OAuth providers are configured
const twitterConfigured = !!(process.env.TWITTER_CLIENT_ID && process.env.TWITTER_CLIENT_SECRET)
const linkedinConfigured = !!(process.env.LINKEDIN_CLIENT_ID && process.env.LINKEDIN_CLIENT_SECRET)

async function getSocialAccounts(userId: string) {
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
}

async function getUserRole(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  })
  return user?.role
}

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
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account and connected platforms</p>
      </div>

      {/* Profile Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Profile
          </CardTitle>
          <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={session.user.image || undefined} alt={session.user.name || ""} />
              <AvatarFallback>
                {session.user.name
                  ?.split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase() || "U"}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold">{session.user.name}</h3>
                {isAdmin && (
                  <Badge variant="secondary" className="gap-1">
                    <Shield className="h-3 w-3" />
                    Admin
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground">{session.user.email}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Social Accounts Section */}
      <Card>
        <CardHeader>
          <CardTitle>Connected Accounts</CardTitle>
          <CardDescription>
            Connect your social media accounts to enable auto-publishing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Twitter */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1DA1F2]/10">
                <Twitter className="h-5 w-5 text-[#1DA1F2]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">Twitter / X</h4>
                  {twitterAccount?.isActive && (
                    <Badge variant="secondary" className="bg-green-100 text-green-700">
                      Connected
                    </Badge>
                  )}
                  {!twitterConfigured && (
                    <Badge variant="outline" className="gap-1 text-yellow-600">
                      <AlertCircle className="h-3 w-3" />
                      Not configured
                    </Badge>
                  )}
                </div>
                {twitterAccount ? (
                  <p className="text-sm text-muted-foreground">
                    @{twitterAccount.platformUsername || "Connected"}
                    {twitterAccount.tokenExpiresAt && (
                      <span className="ml-2">
                        · Expires{" "}
                        {new Date(twitterAccount.tokenExpiresAt).toLocaleDateString()}
                      </span>
                    )}
                  </p>
                ) : !twitterConfigured ? (
                  <p className="text-sm text-muted-foreground">
                    Twitter OAuth not configured. Add credentials to .env.local
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Connect to post to Twitter
                  </p>
                )}
              </div>
            </div>
            {twitterAccount ? (
              <DisconnectButton platform="twitter" accountId={twitterAccount.id} />
            ) : (
              <ConnectButton platform="twitter" disabled={!twitterConfigured} />
            )}
          </div>

          <Separator />

          {/* LinkedIn */}
          <div className="flex items-center justify-between rounded-lg border p-4">
            <div className="flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#0A66C2]/10">
                <Linkedin className="h-5 w-5 text-[#0A66C2]" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-medium">LinkedIn</h4>
                  {linkedInAccount?.isActive && (
                    <Badge variant="secondary" className="bg-green-100 text-green-700">
                      Connected
                    </Badge>
                  )}
                  {!linkedinConfigured && (
                    <Badge variant="outline" className="gap-1 text-yellow-600">
                      <AlertCircle className="h-3 w-3" />
                      Not configured
                    </Badge>
                  )}
                </div>
                {linkedInAccount ? (
                  <p className="text-sm text-muted-foreground">
                    {linkedInAccount.platformUsername || "Connected"}
                    {linkedInAccount.tokenExpiresAt && (
                      <span className="ml-2">
                        · Expires{" "}
                        {new Date(linkedInAccount.tokenExpiresAt).toLocaleDateString()}
                      </span>
                    )}
                  </p>
                ) : !linkedinConfigured ? (
                  <p className="text-sm text-muted-foreground">
                    LinkedIn OAuth not configured. Add credentials to .env.local
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Connect to post to LinkedIn
                  </p>
                )}
              </div>
            </div>
            {linkedInAccount ? (
              <DisconnectButton platform="linkedin" accountId={linkedInAccount.id} />
            ) : (
              <ConnectButton platform="linkedin" disabled={!linkedinConfigured} />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Posting Preferences */}
      <Card>
        <CardHeader>
          <CardTitle>Posting Preferences</CardTitle>
          <CardDescription>Configure how your posts are scheduled and published</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Posts per day</h4>
                <p className="text-sm text-muted-foreground">
                  Maximum posts per platform per day
                </p>
              </div>
              <Badge variant="outline">6 posts</Badge>
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium">Posting times</h4>
                <p className="text-sm text-muted-foreground">
                  Optimal times are automatically selected
                </p>
              </div>
              <Badge variant="outline">Auto</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive">Danger Zone</CardTitle>
          <CardDescription>Irreversible actions for your account</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <h4 className="font-medium">Delete Account</h4>
              <p className="text-sm text-muted-foreground">
                Permanently delete your account and all data
              </p>
            </div>
            <Button variant="destructive" disabled>
              Delete Account
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
