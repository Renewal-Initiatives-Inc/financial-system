'use client'

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import type { RetentionSummary } from './actions'

interface Props {
  summary: RetentionSummary
}

function formatDate(iso: string | null): string {
  if (!iso) return '--'
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function getAgeBadge(ageYears: number | null, policy: string) {
  if (ageYears === null) return <Badge variant="secondary">Empty</Badge>
  if (policy.includes('Indefinite')) return <Badge variant="secondary">N/A</Badge>
  if (ageYears >= 7) return <Badge variant="destructive">Review needed</Badge>
  if (ageYears >= 5) return <Badge variant="outline">Approaching</Badge>
  return <Badge variant="secondary">Within policy</Badge>
}

export function RetentionDashboard({ summary }: Props) {
  const totalRecords = summary.categories.reduce((s, c) => s + c.totalRecords, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Data Retention Review
        </h1>
        <p className="text-muted-foreground mt-2">
          Record age summary per Information Security Policy &sect;6.3.
          Generated {formatDate(summary.generatedAt)}.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Records</CardDescription>
            <CardTitle className="text-2xl">
              {totalRecords.toLocaleString()}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Data Categories</CardDescription>
            <CardTitle className="text-2xl">
              {summary.categories.length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Approaching Threshold</CardDescription>
            <CardTitle className="text-2xl">
              {summary.categories.filter(
                (c) =>
                  !c.retentionPolicy.includes('Indefinite') &&
                  c.ageYears !== null &&
                  c.ageYears >= 5
              ).length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Retention Status by Category</CardTitle>
          <CardDescription>
            Review annually per policy &sect;14. Categories approaching the
            7-year threshold are flagged for System Administrator review.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Category</TableHead>
                <TableHead>Retention Policy</TableHead>
                <TableHead className="text-right">Records</TableHead>
                <TableHead>Oldest Record</TableHead>
                <TableHead>Newest Record</TableHead>
                <TableHead className="text-right">Age (years)</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {summary.categories.map((cat) => (
                <TableRow key={cat.table}>
                  <TableCell className="font-medium">{cat.label}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {cat.retentionPolicy}
                  </TableCell>
                  <TableCell className="text-right">
                    {cat.totalRecords.toLocaleString()}
                  </TableCell>
                  <TableCell>{formatDate(cat.oldestRecord)}</TableCell>
                  <TableCell>{formatDate(cat.newestRecord)}</TableCell>
                  <TableCell className="text-right">
                    {cat.ageYears !== null ? cat.ageYears : '--'}
                  </TableCell>
                  <TableCell>
                    {getAgeBadge(cat.ageYears, cat.retentionPolicy)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
