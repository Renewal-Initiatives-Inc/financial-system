import { Skeleton } from '@/components/ui/skeleton'
import { CardSkeleton } from '@/components/shared/card-skeleton'

export default function DashboardLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <CardSkeleton count={4} />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <CardSkeleton count={2} />
      </div>
    </div>
  )
}
