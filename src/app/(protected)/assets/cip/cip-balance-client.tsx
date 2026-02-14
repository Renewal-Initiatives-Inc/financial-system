'use client'

import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { HelpTooltip } from '@/components/shared/help-tooltip'
import { ArrowRight } from 'lucide-react'
import type { CipBalanceSummary } from '@/lib/assets/cip-conversion'

interface CipBalanceClientProps {
  balances: CipBalanceSummary
  conversions: Array<{
    id: number
    structureName: string
    placedInServiceDate: string
    totalAmountConverted: string
    createdAt: Date
  }>
}

function formatCurrency(value: number | string): string {
  const num = typeof value === 'string' ? Number(value) : value
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(num)
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

const subAccountDescriptions: Record<string, string> = {
  '1510': 'Hard Costs',
  '1520': 'Soft Costs',
  '1530': 'Reserves & Contingency',
  '1540': 'Developer Fee',
  '1550': 'Construction Interest',
}

export function CipBalanceClient({
  balances,
  conversions,
}: CipBalanceClientProps) {
  const router = useRouter()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            CIP Balances
            <HelpTooltip term="cip" />
          </h1>
          <p className="text-muted-foreground mt-1">
            Construction in Progress account balances and conversion history
          </p>
        </div>
        <Button
          onClick={() => router.push('/assets/cip/convert')}
          data-testid="convert-cip-btn"
        >
          Convert to Fixed Asset
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>

      {/* CIP Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Total CIP Balance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">
            {formatCurrency(balances.totalBalance)}
          </div>
        </CardContent>
      </Card>

      {/* Sub-Account Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Sub-Account Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {balances.subAccounts.map((sub) => (
                <TableRow key={sub.accountId}>
                  <TableCell className="font-medium">
                    {sub.accountCode} - {sub.accountName}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {subAccountDescriptions[sub.accountCode] ?? ''}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatCurrency(sub.balance)}
                  </TableCell>
                </TableRow>
              ))}
              <TableRow className="font-bold border-t-2">
                <TableCell colSpan={2}>Total</TableCell>
                <TableCell className="text-right">
                  {formatCurrency(balances.totalBalance)}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Conversion History */}
      <Card>
        <CardHeader>
          <CardTitle>Conversion History</CardTitle>
        </CardHeader>
        <CardContent>
          {conversions.length === 0 ? (
            <p className="text-muted-foreground">
              No CIP conversions have been completed yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Structure</TableHead>
                  <TableHead>Placed in Service</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {conversions.map((conv) => (
                  <TableRow key={conv.id}>
                    <TableCell className="font-medium">
                      {conv.structureName}
                    </TableCell>
                    <TableCell>
                      {formatDate(conv.placedInServiceDate)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(conv.totalAmountConverted)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                      >
                        Converted
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
