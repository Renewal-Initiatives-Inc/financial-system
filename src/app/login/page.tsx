'use client'

import { signIn } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Landmark } from 'lucide-react'

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-6">
        <div className="flex flex-col items-center gap-2">
          <Landmark className="h-10 w-10 text-primary" />
          <h1 className="text-2xl font-semibold tracking-tight">Financial System</h1>
          <p className="text-sm text-muted-foreground">Renewal Initiatives, Inc.</p>
        </div>
        <Button
          data-testid="login-signin-btn"
          className="w-full"
          onClick={() => signIn('zitadel', { callbackUrl: '/' })}
        >
          Sign in with Zitadel
        </Button>
      </div>
    </div>
  )
}
