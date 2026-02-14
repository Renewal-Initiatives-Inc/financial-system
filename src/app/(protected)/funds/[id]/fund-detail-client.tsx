'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Lock, Pencil, Save, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { HelpTooltip } from '@/components/shared/help-tooltip'
import { updateFund, toggleFundActive } from '../actions'
import type { FundDetail } from '../actions'
import { toast } from 'sonner'

function formatCurrency(value: string): string {
  const num = parseFloat(value)
  const prefix = num < 0 ? '-' : ''
  return `${prefix}$${Math.abs(num).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

interface FundDetailClientProps {
  fund: FundDetail
}

export function FundDetailClient({ fund }: FundDetailClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(fund.name)
  const [description, setDescription] = useState(fund.description ?? '')
  const [isConfirmDeactivateOpen, setIsConfirmDeactivateOpen] = useState(false)

  const balance = parseFloat(fund.balance)
  const hasNonZeroBalance = Math.abs(balance) >= 0.005

  const handleSave = () => {
    startTransition(async () => {
      try {
        await updateFund(
          fund.id,
          {
            ...(name !== fund.name ? { name } : {}),
            ...(description !== (fund.description ?? '')
              ? { description: description || null }
              : {}),
          },
          'system'
        )
        setIsEditing(false)
        toast.success('Fund updated')
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to update fund')
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
        await toggleFundActive(fund.id, true, 'system')
        toast.success('Fund reactivated')
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to reactivate')
      }
    })
  }

  const confirmDeactivation = () => {
    startTransition(async () => {
      try {
        await toggleFundActive(fund.id, false, 'system')
        setIsConfirmDeactivateOpen(false)
        toast.success('Fund deactivated')
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
        <Link href="/funds">
          <Button variant="ghost" size="icon" data-testid="fund-detail-back-btn">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {fund.name}
            </h1>
            {fund.isSystemLocked && (
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
                fund.restrictionType === 'RESTRICTED'
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-green-100 text-green-800'
              }
            >
              {fund.restrictionType === 'RESTRICTED'
                ? 'Restricted'
                : 'Unrestricted'}
            </Badge>
            <Badge variant={fund.isActive ? 'default' : 'secondary'}>
              {fund.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        </div>
      </div>

      {/* Balance Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1">
            Balance Summary <HelpTooltip term="fund-balance" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <p className="text-3xl font-bold">{formatCurrency(fund.balance)}</p>
            <p className="text-sm text-muted-foreground">
              Net balance ({fund.transactionCount} transaction
              {fund.transactionCount !== 1 ? 's' : ''})
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Assets</p>
              <p className="font-mono text-sm">{formatCurrency(fund.assetTotal)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Liabilities</p>
              <p className="font-mono text-sm">{formatCurrency(fund.liabilityTotal)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Net Assets</p>
              <p className="font-mono text-sm">{formatCurrency(fund.netAssetTotal)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Revenue</p>
              <p className="font-mono text-sm">{formatCurrency(fund.revenueTotal)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Expenses</p>
              <p className="font-mono text-sm">{formatCurrency(fund.expenseTotal)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Details Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Fund Details</CardTitle>
          {!fund.isSystemLocked && !isEditing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
              data-testid="edit-fund-btn"
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          )}
          {fund.isSystemLocked && (
            <span className="text-sm text-muted-foreground flex items-center gap-1">
              <Lock className="h-3 w-3" /> Editing disabled for system-locked
              funds
            </span>
          )}
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="flex items-center gap-1 text-muted-foreground">
                Name
              </Label>
              {isEditing ? (
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  data-testid="edit-fund-name"
                />
              ) : (
                <p>{fund.name}</p>
              )}
            </div>
            <div>
              <Label className="flex items-center gap-1 text-muted-foreground">
                Restriction Type <HelpTooltip term="restriction-type" />
              </Label>
              <p>
                {fund.restrictionType === 'RESTRICTED'
                  ? 'Restricted'
                  : 'Unrestricted'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Cannot be changed after creation (INV-005)
              </p>
            </div>
          </div>

          <div>
            <Label className="text-muted-foreground">Description</Label>
            {isEditing ? (
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                data-testid="edit-fund-description"
              />
            ) : (
              <p>{fund.description || '-'}</p>
            )}
          </div>

          {isEditing && (
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={isPending} data-testid="save-fund-btn">
                <Save className="mr-2 h-4 w-4" />
                Save
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditing(false)
                  setName(fund.name)
                  setDescription(fund.description ?? '')
                }}
                data-testid="fund-edit-cancel-btn"
              >
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Active Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1">
            Active Status <HelpTooltip term="deactivation" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch
              checked={fund.isActive}
              onCheckedChange={handleToggleActive}
              disabled={fund.isSystemLocked || isPending}
              data-testid="fund-active-toggle"
            />
            <span className="text-sm">
              {fund.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          {fund.isSystemLocked && (
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Lock className="h-3 w-3" /> System-locked funds cannot be
              deactivated
              <HelpTooltip term="system-locked" />
            </p>
          )}
          {!fund.isSystemLocked && hasNonZeroBalance && fund.isActive && (
            <p className="text-sm text-amber-600">
              This fund has a non-zero balance of{' '}
              {formatCurrency(fund.balance)}. It must have a zero balance
              before it can be deactivated (DM-P0-007).
            </p>
          )}
        </CardContent>
      </Card>

      {/* Deactivation Confirmation Dialog */}
      <Dialog open={isConfirmDeactivateOpen} onOpenChange={setIsConfirmDeactivateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate Fund</DialogTitle>
            <DialogDescription>
              Are you sure you want to deactivate{' '}
              <strong>{fund.name}</strong>?
              {hasNonZeroBalance && (
                <>
                  {' '}
                  This fund has a balance of {formatCurrency(fund.balance)}.
                  Deactivation will be blocked if the balance is non-zero.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsConfirmDeactivateOpen(false)}
              data-testid="fund-deactivate-cancel-btn"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeactivation}
              disabled={isPending}
              data-testid="confirm-deactivate-fund-btn"
            >
              Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
