import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { FileQuestion } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="mx-auto max-w-md text-center space-y-4">
        <FileQuestion className="mx-auto h-12 w-12 text-muted-foreground" />
        <h1 className="text-2xl font-semibold">Page not found</h1>
        <p className="text-muted-foreground">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Button asChild data-testid="root-not-found-go-home-btn">
          <Link href="/">Go Home</Link>
        </Button>
      </div>
    </div>
  )
}
