import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface DashboardPanelProps {
  title: string
  icon?: React.ComponentType<{ className?: string }>
  href?: string
  linkLabel?: string
  headerMeta?: React.ReactNode
  className?: string
  contentClassName?: string
  children: React.ReactNode
}

export function DashboardPanel({
  title,
  icon: Icon,
  href,
  linkLabel,
  headerMeta,
  className,
  contentClassName,
  children,
}: DashboardPanelProps) {
  return (
    <Card className={cn('min-h-0 gap-0 overflow-hidden rounded-xl border-border/90 py-0 shadow-[0_2px_10px_rgba(15,23,42,0.035)]', className)}>
      <CardHeader className="flex min-h-[72px] grid-cols-none flex-row items-center justify-between gap-4 px-5 py-5 sm:px-6">
        <CardTitle className="flex items-center gap-3 text-base font-semibold tracking-tight">
          {Icon && <Icon className="h-5 w-5 text-primary" />}
          {title}
        </CardTitle>
        <div className="flex items-center gap-2">
          {headerMeta}
          {href && linkLabel && (
            <Link
              href={href}
              className="flex min-h-10 items-center gap-2 rounded-md px-2 text-sm font-medium text-primary transition-colors hover:bg-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span>{linkLabel}</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </CardHeader>
      <CardContent className={cn('flex min-h-0 flex-1 flex-col px-5 pb-5 sm:px-6 sm:pb-6', contentClassName)}>
        {children}
      </CardContent>
    </Card>
  )
}
