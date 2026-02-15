'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import type { Vendor1099Data } from '@/lib/compliance/vendor-1099'

function fmt(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

export function PrepClient({ data }: { data: Vendor1099Data }) {
  const overThreshold = data.rows.filter((r) => r.exceedsThreshold)
  const belowThreshold = data.rows.filter((r) => !r.exceedsThreshold)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          1099-NEC Preparation — {data.year}
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <a href={`/api/tax-forms/1099?year=${data.year}&format=csv`} download data-testid="1099-export-csv-btn">
              Export CSV
            </a>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Vendors Over Threshold</p>
            <p className="text-2xl font-bold">{data.vendorsOverThreshold}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">W-9 Collected</p>
            <p className="text-2xl font-bold text-green-600">{data.w9CollectedCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">W-9 Pending</p>
            <p className="text-2xl font-bold text-red-600">{data.w9PendingCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Threshold</p>
            <p className="text-2xl font-bold">{fmt(data.threshold)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Vendors Over Threshold ({overThreshold.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {overThreshold.length === 0 ? (
            <p className="text-sm text-muted-foreground">No vendors exceed the threshold.</p>
          ) : (
            <div className="space-y-1">
              <div className="grid grid-cols-6 gap-2 text-xs font-medium text-muted-foreground border-b pb-1">
                <span className="col-span-2">Vendor</span>
                <span className="text-right">Total Paid</span>
                <span>W-9 Status</span>
                <span>Entity Type</span>
                <span>Actions</span>
              </div>
              {overThreshold.map((v) => (
                <div key={v.vendorId} className="grid grid-cols-6 gap-2 text-sm py-1 border-b last:border-0">
                  <span className="col-span-2 truncate">{v.vendorName}</span>
                  <span className="text-right tabular-nums font-medium">{fmt(v.totalPaid)}</span>
                  <span>
                    <Badge
                      variant={v.w9Status === 'COLLECTED' ? 'default' : 'destructive'}
                      className="text-[10px]"
                    >
                      {v.w9Status}
                    </Badge>
                  </span>
                  <span className="text-muted-foreground">{v.entityType ?? '—'}</span>
                  <span>
                    <a
                      href={`/api/tax-forms/1099?year=${data.year}&format=pdf&vendorId=${v.vendorId}`}
                      className="text-xs text-primary hover:underline"
                      download
                      data-testid={`1099-vendor-pdf-${v.vendorId}`}
                    >
                      PDF
                    </a>
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {belowThreshold.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">
              Vendors Below Threshold ({belowThreshold.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-0.5">
              {belowThreshold.map((v) => (
                <div key={v.vendorId} className="flex items-center justify-between text-xs text-muted-foreground py-0.5">
                  <span>{v.vendorName}</span>
                  <span className="tabular-nums">{fmt(v.totalPaid)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground">
        TaxBandits integration for e-filing is planned as a future enhancement.
      </p>
    </div>
  )
}
