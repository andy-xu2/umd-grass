import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="space-y-6" aria-label="Loading dashboard">
      <div className="space-y-2">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-5 w-40" />
      </div>
      <div className="grid items-stretch gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Skeleton className="min-h-[520px] rounded-xl" />
        <div className="flex min-w-0 flex-col gap-6">
          <Skeleton className="h-52 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    </div>
  )
}
