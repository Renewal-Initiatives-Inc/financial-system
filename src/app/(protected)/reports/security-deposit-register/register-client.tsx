'use client'

import { useRouter } from 'next/navigation'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ReportShell } from '@/components/reports/report-shell'
import type { CSVColumnDef } from '@/lib/reports/csv/export-csv'
import type { RegisterData } from '@/lib/reports/security-deposit-register'

function fmt(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value)
}

const MONTH_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
] as const

/**
 * Format an ISO date string (YYYY-MM-DD) without using the Date constructor.
 * Parsing via `new Date("2025-06-15")` interprets the value as midnight UTC,
 * which can shift to the previous day in behind-UTC timezones, causing an
 * SSR hydration mismatch when the server and client are in different zones.
 */
function fmtDate(value: string | null): string {
  if (!value) return '-'
  const [yearStr, monthStr, dayStr] = value.split('-')
  const month = MONTH_SHORT[parseInt(monthStr, 10) - 1]
  const day = parseInt(dayStr, 10)
  return `${month} ${day}, ${yearStr}`
}

function fmtRate(value: number | null): string {
  if (value == null) return '-'
  const capped = Math.min(value, 0.05)
  return `${(capped * 100).toFixed(2)}%`
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

const REGISTER_CSV_COLUMNS: CSVColumnDef[] = [
  { key: 'tenant', label: 'Tenant', format: 'text' },
  { key: 'unit', label: 'Unit', format: 'text' },
  { key: 'deposit', label: 'Deposit', format: 'currency' },
  { key: 'depositDate', label: 'Deposit Date', format: 'date' },
  { key: 'escrowBank', label: 'Escrow Bank', format: 'text' },
  { key: 'interestRate', label: 'Interest Rate', format: 'percent' },
  { key: 'interestAccrued', label: 'Interest Accrued', format: 'currency' },
  { key: 'interestPaidYtd', label: 'Interest Paid YTD', format: 'currency' },
  { key: 'anniversary', label: 'Anniversary', format: 'date' },
  { key: 'nextDue', label: 'Next Due', format: 'date' },
]

function buildExportData(data: RegisterData): Record<string, unknown>[] {
  return data.rows.map((row) => ({
    tenant: row.tenantName,
    unit: row.unitNumber,
    deposit: row.depositAmount,
    depositDate: row.depositDate,
    escrowBank: row.escrowBankRef ?? '',
    interestRate: row.interestRate,
    interestAccrued: row.interestAccrued,
    interestPaidYtd: row.interestPaidYtd,
    anniversary: row.tenancyAnniversary,
    nextDue: row.nextInterestDue,
  }))
}

interface RegisterClientProps {
  data: RegisterData
}

export function RegisterClient({ data }: RegisterClientProps) {
  const router = useRouter()
  const exportData = buildExportData(data)

  return (
    <ReportShell
      title="Security Deposit Register"
      reportSlug="security-deposit-register"
      exportData={exportData}
      csvColumns={REGISTER_CSV_COLUMNS}
    >

      {/* Reconciliation Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Deposits Held
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmt(data.totalDepositsHeld)}</div>
            <p className="text-xs text-muted-foreground">Sum of all tenant deposits</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              GL 2060 — Security Deposits Held
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmt(data.glLiabilityBalance)}</div>
            <p className="text-xs text-muted-foreground">Liability balance</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              GL 1020 — Security Deposit Escrow
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmt(data.glEscrowBalance)}</div>
            <p className="text-xs text-muted-foreground">Escrow asset balance</p>
          </CardContent>
        </Card>
      </div>

      {data.hasVariance && (
        <div className="rounded-md border border-destructive bg-destructive/10 p-4">
          <p className="text-sm font-medium text-destructive">
            Variance detected: Total deposits ({fmt(data.totalDepositsHeld)}) does not
            match GL 2060 balance ({fmt(data.glLiabilityBalance)}). Reconciliation needed.
          </p>
        </div>
      )}

      {/* Per-Tenant Detail */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Tenant</TableHead>
              <TableHead>Unit</TableHead>
              <TableHead className="text-right">Deposit</TableHead>
              <TableHead>Deposit Date</TableHead>
              <TableHead>Escrow Bank</TableHead>
              <TableHead className="text-right">Rate</TableHead>
              <TableHead className="text-right">Accrued</TableHead>
              <TableHead className="text-right">Paid YTD</TableHead>
              <TableHead>Anniversary</TableHead>
              <TableHead>Next Due</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={10} className="h-24 text-center">
                  No security deposits on file.
                </TableCell>
              </TableRow>
            ) : (
              data.rows.map((row) => (
                <TableRow
                  key={row.tenantId}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/tenants/${row.tenantId}`)}
                  data-testid={`register-row-${row.tenantId}`}
                >
                  <TableCell className="font-medium">{row.tenantName}</TableCell>
                  <TableCell className="font-mono text-sm">{row.unitNumber}</TableCell>
                  <TableCell className="text-right">{fmt(row.depositAmount)}</TableCell>
                  <TableCell>{fmtDate(row.depositDate)}</TableCell>
                  <TableCell>{row.escrowBankRef ?? '-'}</TableCell>
                  <TableCell className="text-right">{fmtRate(row.interestRate)}</TableCell>
                  <TableCell className="text-right">{fmt(row.interestAccrued)}</TableCell>
                  <TableCell className="text-right">{fmt(row.interestPaidYtd)}</TableCell>
                  <TableCell>{fmtDate(row.tenancyAnniversary)}</TableCell>
                  <TableCell>{fmtDate(row.nextInterestDue)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          {data.rows.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2} className="font-semibold">Totals</TableCell>
                <TableCell className="text-right font-semibold">
                  {fmt(data.totalDepositsHeld)}
                </TableCell>
                <TableCell colSpan={4} />
                <TableCell className="text-right font-semibold">
                  {fmt(data.rows.reduce((s, r) => s + r.interestPaidYtd, 0))}
                </TableCell>
                <TableCell colSpan={2} />
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>

      {/* Link back to reports */}
      <div className="flex gap-2">
        <Badge
          variant="outline"
          className="cursor-pointer"
          onClick={() => router.push('/reports')}
        >
          Back to Reports
        </Badge>
      </div>
    </ReportShell>
  )
}
