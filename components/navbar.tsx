'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Bell,
  ChevronDown,
  CircleStar,
  LayoutDashboard,
  List,
  LogOut,
  Menu,
  PlusCircle,
  ShieldAlert,
  Trophy,
  User,
  Users,
  Volleyball,
  X,
  ChartNoAxesColumn,
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ThemeToggle } from '@/components/theme-toggle'
import { createClient } from '@/lib/supabase-browser'
import { cn, getInitials } from '@/lib/utils'

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
  { href: '/queue', label: 'Queue', icon: List },
  { href: '/tournament', label: 'Tournament', icon: Trophy },
]

type CurrentUser = {
  name: string
  avatarUrl: string | null
}

export function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [isTournamentAdmin, setIsTournamentAdmin] = useState(false)
  const [pendingCount, setPendingCount] = useState(0)
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null)

  useEffect(() => {
    const supabase = createClient()

    async function checkUser() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      setIsAdmin(ADMIN_IDS.includes(user.id))

      const { data } = await supabase
        .from('users')
        .select('name, avatar_url, is_tournament_admin')
        .eq('id', user.id)
        .single()

      setCurrentUser({
        name: data?.name ?? user.email?.split('@')[0] ?? 'Player',
        avatarUrl: data?.avatar_url ?? null,
      })
      setIsTournamentAdmin(data?.is_tournament_admin === true)
    }

    checkUser()
  }, [])

  useEffect(() => {
    fetch('/api/matches/pending-count')
      .then(response => response.ok ? response.json() : { count: 0 })
      .then(data => setPendingCount(data.count ?? 0))
      .catch(() => {})
  }, [pathname])

  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  const handleSignOut = async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  const allNavItems = [
    ...navItems,
    ...(isAdmin || isTournamentAdmin
      ? [{ href: '/tournament-admin', label: 'Tournament Admin', icon: CircleStar }]
      : []),
    ...(isAdmin ? [{ href: '/admin', label: 'Admin', icon: ShieldAlert }] : []),
  ]

  const navLinks = allNavItems.map(item => {
    const Icon = item.icon
    const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`)

    return (
      <Link
        key={item.href}
        href={item.href}
        prefetch
        className={cn(
          'group flex min-h-11 items-center gap-3 rounded-lg px-4 text-[15px] font-medium text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          isActive
            ? 'bg-primary/7 text-primary'
            : 'hover:bg-secondary hover:text-foreground',
        )}
      >
        <Icon className="h-5 w-5" strokeWidth={1.8} />
        <span className="flex-1">{item.label}</span>
        {item.href === '/dashboard' && pendingCount > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-white">
            {pendingCount > 9 ? '9+' : pendingCount}
          </span>
        )}
      </Link>
    )
  })

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 h-[68px] border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85">
        <div className="flex h-full items-center px-4 sm:px-6 lg:px-8">
          <Button
            variant="ghost"
            size="icon"
            className="mr-3 lg:hidden"
            onClick={() => setMobileMenuOpen(open => !open)}
            aria-label={mobileMenuOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>

          <Link href="/dashboard" className="flex items-center gap-2.5 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Volleyball className="h-7 w-7 text-primary" strokeWidth={1.8} />
            <span className="text-lg font-semibold tracking-tight sm:text-xl">
              <span className="text-primary">UMD</span>
              <span className="hidden font-medium text-foreground sm:inline"> Grass Rankings</span>
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-2 sm:gap-4">
            <ThemeToggle />

            <Link
              href="/submit-match?tab=verify"
              className="relative flex h-10 w-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label={pendingCount > 0 ? `${pendingCount} matches awaiting verification` : 'Match notifications'}
            >
              <Bell className="h-5 w-5" strokeWidth={1.8} />
              {pendingCount > 0 && (
                <span className="absolute right-0.5 top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full border-2 border-background bg-primary px-1 text-[9px] font-bold text-white">
                  {pendingCount > 9 ? '9+' : pendingCount}
                </span>
              )}
            </Link>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-11 gap-2 rounded-lg px-1.5 sm:px-2">
                  <Avatar className="h-9 w-9 border">
                    {currentUser?.avatarUrl && <AvatarImage src={currentUser.avatarUrl} alt={currentUser.name} />}
                    <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
                      {getInitials(currentUser?.name ?? 'Player')}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-40 truncate text-sm font-medium sm:block">
                    {currentUser?.name ?? 'Player'}
                  </span>
                  <ChevronDown className="hidden h-4 w-4 text-muted-foreground sm:block" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>{currentUser?.name ?? 'My account'}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile"><User /> Profile</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleSignOut}
              className="rounded-full text-muted-foreground hover:text-foreground"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <aside
        className={cn(
          'fixed bottom-0 left-0 top-[68px] z-40 flex w-[276px] flex-col border-r bg-background p-5 transition-transform duration-200 lg:translate-x-0',
          mobileMenuOpen ? 'translate-x-0 shadow-xl' : '-translate-x-full',
        )}
      >
        <nav className="space-y-1" aria-label="Primary navigation">{navLinks}</nav>

        <div className="mt-auto">
          <Link
            href="/submit-match"
            className="flex min-h-20 items-center gap-3 rounded-xl bg-secondary/70 px-4 py-3 text-sm font-semibold transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-background text-primary shadow-sm">
              <Volleyball className="h-6 w-6" strokeWidth={1.8} />
            </span>
            <span className="leading-snug">Submit a match</span>
            <span className="ml-auto text-xl font-light text-muted-foreground">›</span>
          </Link>
        </div>
      </aside>

      {mobileMenuOpen && (
        <button
          type="button"
          className="fixed inset-0 top-[68px] z-30 bg-black/25 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Close navigation"
        />
      )}
    </>
  )
}
