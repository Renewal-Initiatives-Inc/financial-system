import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { FileQuestion } from 'lucide-react'

export default function ProtectedNotFound() {
  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <div className="mx-auto max-w-md text-center space-y-4">
        <FileQuestion className="mx-auto h-12 w-12 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">Not found</h1>
        <p className="text-muted-foreground">
          The item you&apos;re looking for doesn&apos;t exist or has been removed.
        </p>
        <Button asChild data-testid="protected-not-found-dashboard-btn">
          <Link href="/">Back to Dashboard</Link>
        </Button>
      </div>
    </div>
  )
}
