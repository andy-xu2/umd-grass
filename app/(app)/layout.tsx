import { Suspense } from 'react'
import { Navbar } from '@/components/navbar'

export default function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <Suspense fallback={null}>
        <Navbar />
      </Suspense>
      <main className="min-h-screen pt-[68px] lg:pl-[276px]">
        <div className="mx-auto w-full max-w-[1480px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  )
}
