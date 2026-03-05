'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, Lock, Pencil, Save, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { HelpTooltip } from '@/components/shared/help-tooltip'
import { formatCurrency, formatDate } from '@/lib/reports/types'
import { updateAccount, toggleAccountActive } from '../actions'
import type { AccountDetail, AccountBalanceDetail } from '../actions'
import { toast } from 'sonner'

const typeLabels: Record<string, string> = {
  ASSET: 'Asset',
  LIABILITY: 'Liability',
  NET_ASSET: 'Net Asset',
  REVENUE: 'Revenue',
  EXPENSE: 'Expense',
}

interface AccountDetailClientProps {
  account: AccountDetail
  balanceDetail: AccountBalanceDetail | null
}

export function AccountDetailClient({ account, balanceDetail }: AccountDetailClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(account.name)
  const [subType, setSubType] = useState(account.subType ?? '')
  const [isConfirmDeactivateOpen, setIsConfirmDeactivateOpen] = useState(false)

  const handleSave = () => {
    startTransition(async () => {
      try {
        await updateAccount(
          account.id,
          {
            ...(name !== account.name ? { name } : {}),
            ...(subType !== (account.subType ?? '') ? { subType: subType || null } : {}),
          }
        )
        setIsEditing(false)
        toast.success('Account updated')
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to update account')
      }
    })
  }

  const handleToggleActive = (active: boolean) => {
    if (!active) {
      setIsConfirmDeactivateOpen(true)
      return
    }
    startTransition(async () => {
      try {
        await toggleAccountActive(account.id, true)
        toast.success('Account reactivated')
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to reactivate')
      }
    })
  }

  const confirmDeactivation = () => {
    startTransition(async () => {
      try {
        await toggleAccountActive(account.id, false)
        setIsConfirmDeactivateOpen(false)
        toast.success('Account deactivated')
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to deactivate')
        setIsConfirmDeactivateOpen(false)
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/accounts">
          <Button variant="ghost" size="icon" data-testid="account-detail-back-btn">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {account.code} - {account.name}
            </h1>
            {account.isSystemLocked && (
              <Badge variant="outline" className="gap-1">
                <Lock className="h-3 w-3" />
                System Locked
              </Badge>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <Badge
              variant="outline"
              className={
                account.type === 'ASSET'
                  ? 'bg-blue-100 text-blue-800'
                  : account.type === 'LIABILITY'
                    ? 'bg-red-100 text-red-800'
                    : account.type === 'NET_ASSET'
                      ? 'bg-purple-100 text-purple-800'
                      : account.type === 'REVENUE'
                        ? 'bg-green-100 text-green-800'
                        : 'bg-orange-100 text-orange-800'
              }
            >
              {typeLabels[account.type]}
            </Badge>
            <Badge variant={account.isActive ? 'default' : 'secondary'}>
              {account.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        </div>
      </div>

      {/* Details Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Account Details</CardTitle>
          {!account.isSystemLocked && !isEditing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
              data-testid="edit-account-btn"
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          )}
          {account.isSystemLocked && (
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Lock className="h-3 w-3" /> Editing disabled for system-locked accounts
            </span>
          )}
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground">Code</Label>
              <p className="font-mono">{account.code}</p>
            </div>
            <div>
              <Label className="flex items-center gap-1 text-muted-foreground">
                Name
              </Label>
              {isEditing ? (
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  data-testid="edit-name-input"
                />
              ) : (
                <p>{account.name}</p>
              )}
            </div>
            <div>
              <Label className="flex items-center gap-1 text-muted-foreground">
                Type <HelpTooltip term="account-type" />
              </Label>
              <p>{typeLabels[account.type]}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Sub-Type</Label>
              {isEditing ? (
                <Input
                  value={subType}
                  onChange={(e) => setSubType(e.target.value)}
                  placeholder="Optional"
                  data-testid="edit-subtype-input"
                />
              ) : (
                <p>{account.subType || '-'}</p>
              )}
            </div>
            <div>
              <Label className="flex items-center gap-1 text-muted-foreground">
                Normal Balance <HelpTooltip term="normal-balance" />
              </Label>
              <p>{account.normalBalance === 'DEBIT' ? 'Debit' : 'Credit'}</p>
            </div>
            <div>
              <Label className="flex items-center gap-1 text-muted-foreground">
                Form 990 Line <HelpTooltip term="form-990-line" />
              </Label>
              <p>{account.form990Line || '-'}</p>
            </div>
          </div>

          {isEditing && (
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={isPending} data-testid="save-account-btn">
                <Save className="mr-2 h-4 w-4" />
                Save
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditing(false)
                  setName(account.name)
                  setSubType(account.subType ?? '')
                }}
                data-testid="account-edit-cancel-btn"
              >
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Balance & Activity Card */}
      {balanceDetail && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>
              {['REVENUE', 'EXPENSE'].includes(account.type) ? 'YTD Balance & Activity' : 'Balance & Activity'}
            </CardTitle>
            <Link
              href={`/reports/transaction-history?accountId=${account.id}`}
              className="text-sm text-primary hover:underline flex items-center gap-1"
            >
              View All in Transaction History
              <ExternalLink className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-muted-foreground text-xs">
                {['REVENUE', 'EXPENSE'].includes(account.type) ? 'YTD Balance' : 'Balance'}
              </Label>
              <p className={`text-2xl font-semibold tabular-nums ${balanceDetail.balance < 0 ? 'text-red-600' : ''}`}>
                {formatCurrency(balanceDetail.balance)}
              </p>
            </div>

            {balanceDetail.recentLines.length > 0 ? (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Memo</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                      <TableHead className="text-right">Balance</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {balanceDetail.recentLines.map((line, i) => (
                      <TableRow key={`${line.transactionId}-${i}`}>
                        <TableCell className="text-sm tabular-nums whitespace-nowrap">
                          {formatDate(line.date)}
                        </TableCell>
                        <TableCell className="text-sm max-w-xs truncate">
                          {line.lineMemo || line.memo}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          {line.debit > 0 ? formatCurrency(line.debit) : ''}
                        </TableCell>
                        <TableCell className="text-right text-sm tabular-nums">
                          {line.credit > 0 ? formatCurrency(line.credit) : ''}
                        </TableCell>
                        <TableCell className={`text-right text-sm tabular-nums font-medium ${line.runningBalance < 0 ? 'text-red-600' : ''}`}>
                          {formatCurrency(line.runningBalance)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No transactions recorded.</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Active Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1">
            Active Status <HelpTooltip term="deactivation" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This account has {account.transactionCount} transaction
            {account.transactionCount !== 1 ? 's' : ''}.
          </p>
          <div className="flex items-center gap-3">
            <Switch
              checked={account.isActive}
              onCheckedChange={handleToggleActive}
              disabled={account.isSystemLocked || isPending}
              data-testid="account-active-toggle"
            />
            <span className="text-sm">
              {account.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          {account.isSystemLocked && (
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Lock className="h-3 w-3" /> System-locked accounts cannot be deactivated
              <HelpTooltip term="system-locked" />
            </p>
          )}
        </CardContent>
      </Card>

      {/* Hierarchy Card */}
      {(account.parent || account.children.length > 0) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1">
              Account Hierarchy <HelpTooltip term="parent-account" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {account.parent && (
              <div>
                <Label className="text-muted-foreground">Parent Account</Label>
                <Link
                  href={`/accounts/${account.parent.id}`}
                  className="text-primary hover:underline block"
                >
                  {account.parent.code} - {account.parent.name}
                </Link>
              </div>
            )}
            {account.children.length > 0 && (
              <div>
                <Label className="text-muted-foreground">
                  Child Accounts ({account.children.length})
                </Label>
                <ul className="mt-1 space-y-1">
                  {account.children.map((child) => (
                    <li key={child.id}>
                      <Link
                        href={`/accounts/${child.id}`}
                        className="text-primary hover:underline text-sm"
                      >
                        {child.code} - {child.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Deactivation Confirmation Dialog */}
      <Dialog open={isConfirmDeactivateOpen} onOpenChange={setIsConfirmDeactivateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate Account</DialogTitle>
            <DialogDescription>
              Are you sure you want to deactivate{' '}
              <strong>
                {account.code} - {account.name}
              </strong>
              ? This account has {account.transactionCount} transaction
              {account.transactionCount !== 1 ? 's' : ''}. It will be hidden from
              selection dropdowns but preserved for historical reporting.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsConfirmDeactivateOpen(false)}
              data-testid="account-deactivate-cancel-btn"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeactivation}
              disabled={isPending}
              data-testid="confirm-deactivate-btn"
            >
              Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
