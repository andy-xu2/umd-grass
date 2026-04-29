'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { LayoutDashboard, Trophy, PlusCircle, User, Menu, X, LogOut, ShieldAlert, Users, List, ChartNoAxesColumn, Volleyball } from 'lucide-react'
import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { createClient } from '@/lib/supabase-browser'

const ADMIN_IDS = [
  process.env.NEXT_PUBLIC_ADMIN_USER_ID,
  process.env.NEXT_PUBLIC_ADMIN_USER_ID_2,
].filter(Boolean) as string[]

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/profile', label: 'Profile', icon: User },
  { href: '/leaderboard', label: 'Leaderboard', icon: ChartNoAxesColumn },
  { href: '/players', label: 'Players', icon: Users },
  { href: '/submit-match', label: 'Submit Match', icon: PlusCircle },
  { href: '/queue', label: 'Queue', icon: List},
  { href: '/tournament', label: 'Tournament', icon: Trophy }

]

export function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    if (ADMIN_IDS.length === 0) return
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsAdmin(!!user && ADMIN_IDS.includes(user.id))
    })
  }, [])

  useEffect(() => {
    fetch('/api/matches/pending-count')
      .then(r => r.ok ? r.json() : { count: 0 })
      .then(data => setPendingCount(data.count ?? 0))
      .catch(() => {})
  }, [pathname])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto max-w-7xl px-4">
        <div className="flex h-16 items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Volleyball className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="hidden text-lg font-bold tracking-tight sm:block">
              UMD Grass Rankings
            </span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden items-center gap-1 md:flex">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              const showBadge = item.href === '/dashboard' && pendingCount > 0
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  prefetch={true}
                  className={cn(
                    'relative flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                  {showBadge && (
                    <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-bold text-destructive-foreground">
                      {pendingCount > 9 ? '9+' : pendingCount}
                    </span>
                  )}
                </Link>
              )
            })}
            {isAdmin && (
              <Link
                href="/admin"
                prefetch={true}
                className={cn(
                  'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors',
                  pathname === '/admin'
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                )}
              >
                <ShieldAlert className="h-4 w-4" />
                Admin
              </Link>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              className="ml-2 text-muted-foreground hover:text-foreground"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>

        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="border-t border-border pb-4 md:hidden">
            <div className="flex flex-col gap-1 pt-4">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                const showBadge = item.href === '/dashboard' && pendingCount > 0
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      'flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors',
                      isActive
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                    {item.label}
                    {showBadge && (
                      <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-bold text-destructive-foreground">
                        {pendingCount > 9 ? '9+' : pendingCount}
                      </span>
                    )}
                  </Link>
                )
              })}
              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors',
                    pathname === '/admin'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  )}
                >
                  <ShieldAlert className="h-5 w-5" />
                  Admin
                </Link>
              )}
              <button
                onClick={handleSignOut}
                className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
              >
                <LogOut className="h-5 w-5" />
                Sign Out
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}
