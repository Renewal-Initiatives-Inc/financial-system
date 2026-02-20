import Link from 'next/link'
import { ArrowLeft, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { getFundingSources } from '../actions'

const statusColors: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-800',
  COMPLETED: 'bg-blue-100 text-blue-800',
  CANCELLED: 'bg-gray-100 text-gray-800',
}

function formatCurrency(value: string | null) {
  if (!value) return '-'
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(parseFloat(value))
}

export default async function FundingSourcesPage() {
  const sources = await getFundingSources()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/revenue">
            <Button variant="ghost" size="icon" data-testid="funding-sources-back-btn">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Funding Sources</h1>
        </div>
        <Link href="/revenue/funding-sources/new">
          <Button data-testid="create-funding-source-btn">
            <Plus className="mr-2 h-4 w-4" />
            New Funding Source
          </Button>
        </Link>
      </div>

      {sources.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">No funding sources yet.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="px-4 py-3 text-left font-medium">Name</th>
                <th className="px-4 py-3 text-left font-medium">Restriction</th>
                <th className="px-4 py-3 text-left font-medium">Funder</th>
                <th className="px-4 py-3 text-left font-medium">Amount</th>
                <th className="px-4 py-3 text-left font-medium">Type</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((source) => (
                <tr key={source.id} className="border-b">
                  <td className="px-4 py-3">
                    <Link
                      href={`/revenue/funding-sources/${source.id}`}
                      className="text-primary hover:underline"
                      data-testid={`funding-source-row-${source.id}`}
                    >
                      {source.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Badge
                      variant="outline"
                      className={
                        source.restrictionType === 'RESTRICTED'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-green-100 text-green-800'
                      }
                    >
                      {source.restrictionType === 'RESTRICTED' ? 'Restricted' : 'Unrestricted'}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">{source.funderName ?? '-'}</td>
                  <td className="px-4 py-3">{formatCurrency(source.amount)}</td>
                  <td className="px-4 py-3">
                    {source.type ? (
                      <Badge variant="outline">
                        {source.type === 'CONDITIONAL' ? 'Conditional' : 'Unconditional'}
                      </Badge>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {source.status ? (
                      <Badge
                        variant="outline"
                        className={statusColors[source.status] ?? ''}
                      >
                        {source.status}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className={source.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}>
                        {source.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    )}
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
