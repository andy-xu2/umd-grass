'use client'

import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ThemeToggleProps {
  className?: string
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const isDark = resolvedTheme === 'dark'
  const label = isDark ? 'Switch to light mode' : 'Switch to dark mode'

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className={cn('rounded-full text-muted-foreground hover:text-foreground', className)}
      // No `disabled` before mount: Firefox restores a button's enabled state on
      // reload, which strips the server's attribute and breaks hydration.
      onClick={() => mounted && setTheme(isDark ? 'light' : 'dark')}
      title={mounted ? label : 'Change color theme'}
      aria-label={mounted ? label : 'Change color theme'}
    >
      {mounted && isDark ? (
        <Sun className="h-4 w-4" />
      ) : (
        <Moon className={cn('h-4 w-4', !mounted && 'opacity-0')} />
      )}
    </Button>
  )
}
