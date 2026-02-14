import Link from 'next/link'
import { ArrowLeft, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getGrants } from '../actions'

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  COMPLETED: 'bg-blue-100 text-blue-800',
  CANCELLED: 'bg-gray-100 text-gray-800',
}

function formatCurrency(value: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(parseFloat(value))
}

export default async function GrantsPage() {
  const grants = await getGrants()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/revenue">
            <Button variant="ghost" size="icon" data-testid="grants-back-btn">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Grants</h1>
        </div>
        <Link href="/revenue/grants/new">
          <Button data-testid="create-grant-btn">
            <Plus className="mr-2 h-4 w-4" />
            New Grant
          </Button>
        </Link>
      </div>

      {grants.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">No grants recorded yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Funder</th>
                <th className="px-4 py-3 text-left font-medium">Amount</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Fund</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {grants.map((grant) => (
                <tr key={grant.id} className="border-b">
                  <td className="px-4 py-3">
                    <Link
                      href={`/revenue/grants/${grant.id}`}
                      className="text-primary hover:underline"
                      data-testid={`grant-row-${grant.id}`}
                    >
                      {grant.funderName}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{formatCurrency(grant.amount)}</td>
                  <td className="px-4 py-3">
                    <Badge variant="outline">
                      {grant.type === 'CONDITIONAL' ? 'Conditional' : 'Unconditional'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">{grant.fundName}</td>
                  <td className="px-4 py-3">
                    <Badge
                      variant="outline"
                      className={statusColors[grant.status] ?? ''}
                    >
                      {grant.status}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
