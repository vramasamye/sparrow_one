import { Rss } from "lucide-react"
import Link from "next/link"

import { LoginButtons } from "./login-buttons"

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/50">
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[400px]">
        <div className="flex flex-col items-center space-y-2 text-center">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Rss className="h-5 w-5" />
            </div>
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Welcome to Sparrow</h1>
          <p className="text-sm text-muted-foreground">
            Sign in to start publishing AI-powered content to your social media
          </p>
        </div>

        <div className="rounded-lg border bg-background p-6 shadow-sm">
          <LoginButtons />
        </div>

        <p className="px-8 text-center text-sm text-muted-foreground">
          By signing in, you agree to our{" "}
          <Link href="/terms" className="underline underline-offset-4 hover:text-primary">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" className="underline underline-offset-4 hover:text-primary">
            Privacy Policy
          </Link>
          .
        </p>
      </div>
    </div>
  )
}
