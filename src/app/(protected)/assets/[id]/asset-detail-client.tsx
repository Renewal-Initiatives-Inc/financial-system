'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { HelpTooltip } from '@/components/shared/help-tooltip'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ArrowLeft, Pencil, Save, X } from 'lucide-react'
import { toast } from 'sonner'
import { updateFixedAsset, toggleFixedAssetActive } from '../actions'
import type { FixedAssetDetail } from '../actions'

interface AssetDetailClientProps {
  asset: FixedAssetDetail
  accountOptions: { id: number; name: string; code: string; subType: string | null }[]
}

function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? Number(value) : value
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(num)
}

function formatDate(date: string | null): string {
  if (!date) return '-'
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatUsefulLife(months: number): string {
  const years = Math.floor(months / 12)
  const remainder = months % 12
  if (remainder === 0) return `${years} years (${months} months)`
  return `${years} years, ${remainder} months`
}

export function AssetDetailClient({
  asset,
  accountOptions: _accountOptions,
}: AssetDetailClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(asset.name)
  const [editDescription, setEditDescription] = useState(
    asset.description ?? ''
  )
  const [editPisDate, setEditPisDate] = useState(
    asset.datePlacedInService ?? ''
  )

  // Depreciation progress
  const depreciableBasis = Number(asset.cost) - Number(asset.salvageValue)
  const accumulated = Number(asset.accumulatedDepreciation)
  const progressPct =
    depreciableBasis > 0 ? Math.min((accumulated / depreciableBasis) * 100, 100) : 0
  const remainingMonths =
    Number(asset.monthlyDepreciation) > 0
      ? Math.ceil(
          (depreciableBasis - accumulated) / Number(asset.monthlyDepreciation)
        )
      : 0

  const statusBadge = () => {
    if (!asset.isActive) return <Badge variant="secondary">Inactive</Badge>
    if (asset.isFullyDepreciated) {
      return (
        <Badge
          variant="outline"
          className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
        >
          Fully Depreciated
        </Badge>
      )
    }
    if (!asset.datePlacedInService) {
      return (
        <Badge
          variant="outline"
          className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
        >
          Not in Service
        </Badge>
      )
    }
    return <Badge variant="default">Active</Badge>
  }

  const handleSave = () => {
    startTransition(async () => {
      try {
        await updateFixedAsset(
          asset.id,
          {
            name: editName.trim(),
            description: editDescription.trim() || null,
            datePlacedInService: editPisDate || null,
          },
          'current-user'
        )
        toast.success('Asset updated')
        setIsEditing(false)
        router.refresh()
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Failed to update asset'
        )
      }
    })
  }

  const handleToggleActive = () => {
    startTransition(async () => {
      try {
        await toggleFixedAssetActive(
          asset.id,
          !asset.isActive,
          'current-user'
        )
        toast.success(
          asset.isActive ? 'Asset deactivated' : 'Asset reactivated'
        )
        router.refresh()
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Failed to toggle asset status'
        )
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/assets')}
            data-testid="asset-detail-back-btn"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold tracking-tight">
                {asset.name}
              </h1>
              {statusBadge()}
            </div>
            {asset.parentAssetName && (
              <p className="text-sm text-muted-foreground mt-1">
                Component of {asset.parentAssetName}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(false)}
                disabled={isPending}
                data-testid="asset-detail-cancel-btn"
              >
                <X className="h-4 w-4 mr-1" />
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={isPending}
                data-testid="asset-detail-save-btn"
              >
                <Save className="h-4 w-4 mr-1" />
                {isPending ? 'Saving...' : 'Save'}
              </Button>
            </>
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
                data-testid="asset-detail-edit-btn"
              >
                <Pencil className="h-4 w-4 mr-1" />
                Edit
              </Button>
              <Button
                variant={asset.isActive ? 'destructive' : 'default'}
                size="sm"
                onClick={handleToggleActive}
                disabled={isPending}
                data-testid="asset-detail-toggle-active-btn"
              >
                {asset.isActive ? 'Deactivate' : 'Reactivate'}
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Asset Details Card */}
      <Card>
        <CardHeader>
          <CardTitle>Asset Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-x-8 gap-y-4">
            <div>
              <Label className="text-muted-foreground">Name</Label>
              {isEditing ? (
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  data-testid="asset-detail-name-input"
                />
              ) : (
                <p className="font-medium">{asset.name}</p>
              )}
            </div>
            <div>
              <Label className="text-muted-foreground">Description</Label>
              {isEditing ? (
                <Input
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="Optional"
                  data-testid="asset-detail-description-input"
                />
              ) : (
                <p>{asset.description || '-'}</p>
              )}
            </div>
            <div>
              <Label className="text-muted-foreground">Acquisition Date</Label>
              <p>{formatDate(asset.acquisitionDate)}</p>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Label className="text-muted-foreground">
                  Date Placed in Service
                </Label>
                <HelpTooltip term="date-placed-in-service" />
              </div>
              {isEditing ? (
                <Input
                  type="date"
                  value={editPisDate}
                  onChange={(e) => setEditPisDate(e.target.value)}
                  data-testid="asset-detail-pis-date-input"
                />
              ) : (
                <p>{formatDate(asset.datePlacedInService)}</p>
              )}
            </div>
            <div>
              <Label className="text-muted-foreground">Cost</Label>
              <p className="font-medium">{formatCurrency(asset.cost)}</p>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Label className="text-muted-foreground">Salvage Value</Label>
                <HelpTooltip term="salvage-value" />
              </div>
              <p>{formatCurrency(asset.salvageValue)}</p>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Label className="text-muted-foreground">Useful Life</Label>
                <HelpTooltip term="useful-life" />
              </div>
              <p>{formatUsefulLife(asset.usefulLifeMonths)}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Method</Label>
              <p>Straight-Line</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Asset Account</Label>
              <p>{asset.glAssetAccountName}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">
                Accum. Depreciation Account
              </Label>
              <p>{asset.glAccumDeprAccountName}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Expense Account</Label>
              <p>{asset.glExpenseAccountName}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Depreciation Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Depreciation Summary
            <HelpTooltip term="depreciation" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-4 gap-4">
            <div>
              <Label className="text-muted-foreground">Monthly Amount</Label>
              <p className="text-lg font-medium">
                {formatCurrency(asset.monthlyDepreciation)}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground">
                Accumulated
              </Label>
              <p className="text-lg font-medium">
                {formatCurrency(asset.accumulatedDepreciation)}
              </p>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <Label className="text-muted-foreground">Net Book Value</Label>
                <HelpTooltip term="net-book-value" />
              </div>
              <p className="text-lg font-bold">
                {formatCurrency(asset.netBookValue)}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground">Remaining Months</Label>
              <p className="text-lg font-medium">
                {asset.isFullyDepreciated ? '0' : remainingMonths}
              </p>
            </div>
          </div>
          <div className="space-y-1">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>
                {formatCurrency(accumulated)} of{' '}
                {formatCurrency(depreciableBasis)}
              </span>
              <span>{progressPct.toFixed(1)}%</span>
            </div>
            <Progress value={progressPct} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Component Breakdown (parent assets only) */}
      {asset.children.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Component Breakdown
              <HelpTooltip term="component-depreciation" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Component</TableHead>
                  <TableHead className="text-right">Cost</TableHead>
                  <TableHead>Useful Life</TableHead>
                  <TableHead className="text-right">Monthly Depr.</TableHead>
                  <TableHead className="text-right">Accum. Depr.</TableHead>
                  <TableHead className="text-right">Net Book Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {asset.children.map((child) => (
                  <TableRow
                    key={child.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/assets/${child.id}`)}
                  >
                    <TableCell className="font-medium">{child.name}</TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(child.cost)}
                    </TableCell>
                    <TableCell>
                      {formatUsefulLife(child.usefulLifeMonths)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(child.monthlyDepreciation)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(child.accumulatedDepreciation)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(child.netBookValue)}
                    </TableCell>
                  </TableRow>
                ))}
                {/* Totals */}
                <TableRow className="font-bold border-t-2">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(
                      asset.children.reduce((s, c) => s + Number(c.cost), 0)
                    )}
                  </TableCell>
                  <TableCell />
                  <TableCell className="text-right">
                    {formatCurrency(
                      asset.children.reduce(
                        (s, c) => s + Number(c.monthlyDepreciation),
                        0
                      )
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(
                      asset.children.reduce(
                        (s, c) => s + Number(c.accumulatedDepreciation),
                        0
                      )
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(
                      asset.children.reduce(
                        (s, c) => s + Number(c.netBookValue),
                        0
                      )
                    )}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* CIP Conversion Info */}
      {asset.cipConversion && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              CIP Conversion
              <HelpTooltip term="cip-conversion" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-muted-foreground">Structure</Label>
                <p className="font-medium">
                  {asset.cipConversion.structureName}
                </p>
              </div>
              <div>
                <Label className="text-muted-foreground">Conversion Date</Label>
                <p>{formatDate(asset.cipConversion.placedInServiceDate)}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">Total Converted</Label>
                <p className="font-medium">
                  {formatCurrency(asset.cipConversion.totalAmountConverted)}
                </p>
              </div>
            </div>
            <div className="mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  router.push(
                    `/transactions?id=${asset.cipConversion!.glTransactionId}`
                  )
                }
                data-testid="asset-detail-view-reclass-je-btn"
              >
                View Reclassification JE
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
