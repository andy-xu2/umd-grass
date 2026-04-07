'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { Trophy, Loader2, ArrowLeft, Mail } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import { toast } from 'sonner'

function VerifyContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const email = searchParams.get('email') ?? ''

  const [code, setCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isResending, setIsResending] = useState(false)

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault()
    if (code.length !== 8) return
    setIsLoading(true)

    const supabase = createClient()
    const { error } = await supabase.auth.verifyOtp({
      email,
      token: code,
      type: 'signup',
    })

    if (error) {
      toast.error(error.message)
      setIsLoading(false)
      setCode('')
      return
    }

    // Create user row in DB
    const res = await fetch('/api/users', { method: 'POST' })
    if (!res.ok) {
      toast.error('Account created but profile setup failed. Contact an admin.')
    }

    toast.success('Email verified! Welcome.')
    router.push('/dashboard')
  }

  async function handleResend() {
    if (!email) return
    setIsResending(true)
    const supabase = createClient()
    const { error } = await supabase.auth.resend({ type: 'signup', email })
    if (error) {
      toast.error(error.message)
    } else {
      toast.success('Verification code resent — check your inbox.')
    }
    setIsResending(false)
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary">
            <Trophy className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="mt-4 text-2xl font-bold">UMD Grass Rankings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Verify your email</p>
        </div>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Check your email</CardTitle>
            <CardDescription>
              We sent an 8-digit code to{' '}
              <span className="font-medium text-foreground">{email || 'your email'}</span>.
              Enter it below to confirm your account.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleVerify} className="space-y-6">
              <div className="flex flex-col items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Mail className="h-6 w-6 text-primary" />
                </div>
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={8}
                    value={code}
                    onChange={setCode}
                    autoFocus
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                      <InputOTPSlot index={6} />
                      <InputOTPSlot index={7} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || code.length !== 8}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Verify Email'
                )}
              </Button>
            </form>

            <div className="mt-4 text-center text-sm text-muted-foreground">
              {"Didn't receive it? "}
              <button
                type="button"
                onClick={handleResend}
                disabled={isResending || !email}
                className="font-medium text-primary hover:underline disabled:opacity-50"
              >
                {isResending ? 'Resending...' : 'Resend code'}
              </button>
            </div>

            <div className="mt-6 flex justify-center">
              <Link
                href="/signup"
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to sign up
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default function VerifyPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <VerifyContent />
    </Suspense>
  )
}
