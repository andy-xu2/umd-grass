'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp'
import { Trophy, Loader2, ArrowLeft } from 'lucide-react'
import Link from 'next/link'

export default function VerifyPage() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (code.length !== 6) return
    setIsLoading(true)
    // Simulate verification
    await new Promise(resolve => setTimeout(resolve, 1500))
    router.push('/dashboard')
  }

  const handleResend = async () => {
    // Simulate resend
    await new Promise(resolve => setTimeout(resolve, 500))
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-primary">
            <Trophy className="h-8 w-8 text-primary-foreground" />
          </div>
          <h1 className="mt-4 text-2xl font-bold">UMD Grass Rankings</h1>
          <p className="mt-1 text-sm text-muted-foreground">Verify your account</p>
        </div>

        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-xl">Two-Factor Authentication</CardTitle>
            <CardDescription>
              {"We've sent a 6-digit code to your email. Enter it below to verify your account."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
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
            <div className="mt-6 flex flex-col items-center gap-4">
              <button
                type="button"
                onClick={handleResend}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                {"Didn't receive a code? "}
                <span className="font-medium text-primary">Resend</span>
              </button>
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
