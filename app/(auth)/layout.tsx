import { ThemeToggle } from '@/components/theme-toggle'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <ThemeToggle className="fixed right-4 top-4 z-50 sm:right-6 sm:top-6" />
      {children}
    </div>
  )
}
