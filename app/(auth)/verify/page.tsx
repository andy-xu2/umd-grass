'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { Trophy, Loader2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'
import { toast } from 'sonner'
import Image from 'next/image'

function VerifyContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const mode = searchParams.get('mode') ?? 'challenge'

  const [code, setCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  // Enroll mode state
  const [factorId, setFactorId] = useState('')
  const [qrCode, setQrCode] = useState('')
  const [secret, setSecret] = useState('')
  const [enrollLoading, setEnrollLoading] = useState(true)

  // Challenge mode state
  const [challengeId, setChallengeId] = useState('')

  useEffect(() => {
    if (mode === 'enroll') {
      enrollTotp()
    } else {
      setupChallenge()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode])

  async function enrollTotp() {
    const supabase = createClient()
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      issuer: 'UMD Grass Rankings',
    })
    if (error) {
      toast.error(error.message)
      setEnrollLoading(false)
      return
    }
    setFactorId(data.id)
    setQrCode(data.totp.qr_code)
    setSecret(data.totp.secret)
    setEnrollLoading(false)
  }

  async function setupChallenge() {
    const supabase = createClient()
    const { data: factors } = await supabase.auth.mfa.listFactors()
    const totpFactor = factors?.totp?.[0]
    if (!totpFactor) {
      router.push('/dashboard')
      return
    }
    const { data, error } = await supabase.auth.mfa.challenge({ factorId: totpFactor.id })
    if (error) {
      toast.error(error.message)
      return
    }
    setFactorId(totpFactor.id)
    setChallengeId(data.id)
    setEnrollLoading(false)
  }

  async function handleEnrollVerify() {
    setIsLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code })
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
    router.push('/dashboard')
  }

  async function handleChallengeVerify() {
    setIsLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.mfa.verify({ factorId, challengeId, code })
    if (error) {
      toast.error(error.message)
      setIsLoading(false)
      setCode('')
      return
    }
    router.push('/dashboard')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (code.length !== 6) return
    if (mode === 'enroll') {
      await handleEnrollVerify()
    } else {
      await handleChallengeVerify()
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary">
            <Trophy className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="mt-4 text-2xl font-bold">UMD Grass Rankings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {mode === 'enroll' ? 'Set up two-factor authentication' : 'Verify your identity'}
          </p>
        </div>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Two-Factor Authentication</CardTitle>
            <CardDescription>
              {mode === 'enroll'
                ? 'Scan the QR code with your authenticator app (e.g. Google Authenticator), then enter the 6-digit code to confirm.'
                : 'Enter the 6-digit code from your authenticator app.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {enrollLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-6">
                {mode === 'enroll' && qrCode && (
                  <div className="flex flex-col items-center gap-3">
                    <div className="rounded-lg border bg-white p-2">
                      <Image src={qrCode} alt="TOTP QR Code" width={160} height={160} />
                    </div>
                    <p className="text-center text-xs text-muted-foreground">
                      {"Can't scan? Enter this code manually:"}
                    </p>
                    <code className="rounded bg-muted px-2 py-1 text-xs font-mono break-all text-center">
                      {secret}
                    </code>
                  </div>
                )}
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={6}
                    value={code}
                    onChange={(value) => setCode(value)}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <Button type="submit" className="w-full" disabled={isLoading || code.length !== 6}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    'Verify'
                  )}
                </Button>
              </form>
            )}
            <div className="mt-6 flex justify-center">
              <Link
                href={mode === 'enroll' ? '/signup' : '/login'}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                {mode === 'enroll' ? 'Back to sign up' : 'Back to login'}
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
