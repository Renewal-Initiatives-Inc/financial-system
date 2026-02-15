'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { HelpTooltip } from '@/components/shared/help-tooltip'
import { ArrowLeft, ArrowRight, Check } from 'lucide-react'
import { toast } from 'sonner'
import { executeCipConversionAction } from '../../actions'
import type { CipBalanceSummary } from '@/lib/assets/cip-conversion'

interface ConversionWizardClientProps {
  cipBalances: CipBalanceSummary
  convertedStructures: string[]
  accountOptions: {
    id: number
    name: string
    code: string
    subType: string | null
  }[]
}

interface ComponentAllocation {
  name: string
  usefulLifeMonths: number
  amount: string
  glAssetAccountId: number
  glAccumDeprAccountId: number
  glExpenseAccountId: number
}

const STRUCTURES = ['Lodging', 'Barn', 'Garage'] as const

// Default GAAP useful lives for Lodging components
const LODGING_DEFAULTS: Omit<
  ComponentAllocation,
  'glAssetAccountId' | 'glAccumDeprAccountId' | 'glExpenseAccountId'
>[] = [
  { name: 'Lodging - Structure', usefulLifeMonths: 480, amount: '' },
  { name: 'Lodging - Roof', usefulLifeMonths: 300, amount: '' },
  { name: 'Lodging - HVAC', usefulLifeMonths: 240, amount: '' },
  { name: 'Lodging - Electrical', usefulLifeMonths: 300, amount: '' },
  { name: 'Lodging - Plumbing', usefulLifeMonths: 300, amount: '' },
  { name: 'Lodging - Windows', usefulLifeMonths: 300, amount: '' },
  { name: 'Lodging - Flooring', usefulLifeMonths: 120, amount: '' },
]

function formatCurrency(value: number | string): string {
  const num = typeof value === 'string' ? Number(value) : value
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(num)
}

export function ConversionWizardClient({
  cipBalances,
  convertedStructures,
  accountOptions,
}: ConversionWizardClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [step, setStep] = useState(1)

  // Step 1: Selected structure
  const [selectedStructure, setSelectedStructure] = useState<string>('')

  // Step 2: Selected CIP sources
  const [selectedSources, setSelectedSources] = useState<
    Record<number, string>
  >({})

  // Step 3: Component allocations
  const [allocations, setAllocations] = useState<ComponentAllocation[]>([])

  // Step 4-5: PIS date
  const [pisDate, setPisDate] = useState('')

  // Resolve GL accounts by code
  const findAccountByCode = (code: string) =>
    accountOptions.find((a) => a.code === code)

  const deprExpenseAccount = findAccountByCode('5200')

  // GL account mapping by structure
  const structureGlAccounts: Record<
    string,
    { asset: string; accumDepr: string }
  > = {
    Lodging: { asset: '1600', accumDepr: '1800' },
    Barn: { asset: '1610', accumDepr: '1810' },
    Garage: { asset: '1620', accumDepr: '1820' },
  }

  const totalSelectedAmount = Object.values(selectedSources).reduce(
    (sum, val) => sum + (Number(val) || 0),
    0
  )

  const totalAllocated = allocations.reduce(
    (sum, a) => sum + (Number(a.amount) || 0),
    0
  )

  // Initialize allocations when moving from step 2 to step 3
  const initAllocations = () => {
    const gl = structureGlAccounts[selectedStructure]
    const assetAccount = gl ? findAccountByCode(gl.asset) : undefined
    const accumAccount = gl ? findAccountByCode(gl.accumDepr) : undefined

    if (selectedStructure === 'Lodging') {
      setAllocations(
        LODGING_DEFAULTS.map((d) => ({
          ...d,
          glAssetAccountId: assetAccount?.id ?? 0,
          glAccumDeprAccountId: accumAccount?.id ?? 0,
          glExpenseAccountId: deprExpenseAccount?.id ?? 0,
        }))
      )
    } else {
      setAllocations([
        {
          name: selectedStructure,
          usefulLifeMonths: 480,
          amount: String(totalSelectedAmount),
          glAssetAccountId: assetAccount?.id ?? 0,
          glAccumDeprAccountId: accumAccount?.id ?? 0,
          glExpenseAccountId: deprExpenseAccount?.id ?? 0,
        },
      ])
    }
  }

  const handleExecute = () => {
    startTransition(async () => {
      try {
        // Build allocations input
        const sourceEntries = Object.entries(selectedSources)
          .filter(([, amt]) => Number(amt) > 0)

        // For each allocation, map to the first source (simplified)
        // In a production version, you'd allow per-component source selection
        const conversionAllocations = allocations.map((alloc) => ({
          sourceCipAccountId: Number(sourceEntries[0]?.[0] ?? 0),
          sourceCostCodeId: null,
          targetAssetName: alloc.name,
          targetUsefulLifeMonths: alloc.usefulLifeMonths,
          targetGlAssetAccountId: alloc.glAssetAccountId,
          targetGlAccumDeprAccountId: alloc.glAccumDeprAccountId,
          targetGlExpenseAccountId: alloc.glExpenseAccountId,
          amount: Number(alloc.amount),
        }))

        await executeCipConversionAction(
          {
            structureName: selectedStructure,
            placedInServiceDate: pisDate,
            allocations: conversionAllocations,
          },
          'current-user'
        )

        toast.success(
          `${selectedStructure} converted to fixed assets successfully`
        )
        router.push('/assets')
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Conversion failed'
        )
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/assets/cip')}
          data-testid="cip-convert-back-to-cip-btn"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to CIP
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            CIP-to-Fixed-Asset Conversion
            <HelpTooltip term="cip-conversion" />
          </h1>
          <p className="text-muted-foreground mt-1">
            Step {step} of 5
          </p>
        </div>
      </div>

      {/* Step indicators */}
      <div className="flex items-center gap-2">
        {[1, 2, 3, 4, 5].map((s) => (
          <div
            key={s}
            className={`h-2 flex-1 rounded-full ${
              s <= step
                ? 'bg-primary'
                : 'bg-muted'
            }`}
          />
        ))}
      </div>

      {/* Step 1: Select Structure */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 1: Select Structure</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {STRUCTURES.map((structure) => {
              const isConverted = convertedStructures.includes(structure)
              return (
                <div
                  key={structure}
                  className={`p-4 border rounded-lg cursor-pointer transition-colors ${
                    isConverted
                      ? 'opacity-50 cursor-not-allowed bg-muted'
                      : selectedStructure === structure
                        ? 'border-primary bg-primary/5'
                        : 'hover:border-primary/50'
                  }`}
                  onClick={() => !isConverted && setSelectedStructure(structure)}
                  data-testid={`structure-${structure.toLowerCase()}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{structure}</span>
                    {isConverted ? (
                      <Badge
                        variant="outline"
                        className="bg-green-100 text-green-800"
                      >
                        Already Converted
                      </Badge>
                    ) : selectedStructure === structure ? (
                      <Check className="h-5 w-5 text-primary" />
                    ) : null}
                  </div>
                </div>
              )
            })}

            <div className="pt-4">
              <Label>Placed in Service Date</Label>
              <Input
                type="date"
                value={pisDate}
                onChange={(e) => setPisDate(e.target.value)}
                className="max-w-xs mt-1"
                data-testid="pis-date-input"
              />
            </div>

            <div className="flex justify-end">
              <Button
                onClick={() => {
                  if (!selectedStructure) {
                    toast.error('Please select a structure')
                    return
                  }
                  if (!pisDate) {
                    toast.error('Please enter a placed-in-service date')
                    return
                  }
                  setStep(2)
                }}
                disabled={!selectedStructure || !pisDate}
                data-testid="cip-convert-step1-next-btn"
              >
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Select CIP Sources */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 2: Select CIP Sources</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>CIP Sub-Account</TableHead>
                  <TableHead className="text-right">Available</TableHead>
                  <TableHead className="text-right">Amount to Convert</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cipBalances.subAccounts
                  .filter((s) => s.balance > 0)
                  .map((sub) => (
                    <TableRow key={sub.accountId}>
                      <TableCell>
                        {sub.accountCode} - {sub.accountName}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(sub.balance)}
                      </TableCell>
                      <TableCell className="text-right w-48">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max={sub.balance}
                          value={selectedSources[sub.accountId] ?? ''}
                          onChange={(e) =>
                            setSelectedSources((prev) => ({
                              ...prev,
                              [sub.accountId]: e.target.value,
                            }))
                          }
                          placeholder="0.00"
                          className="text-right"
                          data-testid={`cip-convert-source-amount-${sub.accountId}-input`}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
              </TableBody>
            </Table>

            <div className="text-right font-bold text-lg">
              Total Selected: {formatCurrency(totalSelectedAmount)}
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(1)} data-testid="cip-convert-step2-back-btn">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button
                onClick={() => {
                  if (totalSelectedAmount <= 0) {
                    toast.error('Please select at least one CIP source')
                    return
                  }
                  initAllocations()
                  setStep(3)
                }}
                disabled={totalSelectedAmount <= 0}
                data-testid="cip-convert-step2-next-btn"
              >
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Allocate to Components */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Step 3: Allocate to Components
              <HelpTooltip term="component-depreciation" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Component</TableHead>
                  <TableHead className="text-right">Amount ($)</TableHead>
                  <TableHead className="text-right">
                    Useful Life (months)
                  </TableHead>
                  <TableHead className="text-right">Monthly Depr.</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allocations.map((alloc, i) => {
                  const monthly =
                    Number(alloc.amount) > 0 && alloc.usefulLifeMonths > 0
                      ? Number(alloc.amount) / alloc.usefulLifeMonths
                      : 0
                  return (
                    <TableRow key={i}>
                      <TableCell>
                        <Input
                          value={alloc.name}
                          onChange={(e) => {
                            const updated = [...allocations]
                            updated[i] = { ...updated[i], name: e.target.value }
                            setAllocations(updated)
                          }}
                          className="max-w-xs"
                          data-testid={`cip-convert-component-name-${i}-input`}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={alloc.amount}
                          onChange={(e) => {
                            const updated = [...allocations]
                            updated[i] = {
                              ...updated[i],
                              amount: e.target.value,
                            }
                            setAllocations(updated)
                          }}
                          className="text-right w-32"
                          data-testid={`cip-convert-component-amount-${i}-input`}
                        />
                      </TableCell>
                      <TableCell className="text-right">
                        <Input
                          type="number"
                          min="1"
                          value={alloc.usefulLifeMonths}
                          onChange={(e) => {
                            const updated = [...allocations]
                            updated[i] = {
                              ...updated[i],
                              usefulLifeMonths: Number(e.target.value),
                            }
                            setAllocations(updated)
                          }}
                          className="text-right w-24"
                          data-testid={`cip-convert-component-life-${i}-input`}
                        />
                      </TableCell>
                      <TableCell className="text-right text-muted-foreground">
                        {formatCurrency(monthly)}
                      </TableCell>
                    </TableRow>
                  )
                })}
                <TableRow className="font-bold border-t-2">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right">
                    {formatCurrency(totalAllocated)}
                  </TableCell>
                  <TableCell />
                  <TableCell />
                </TableRow>
              </TableBody>
            </Table>

            {Math.abs(totalAllocated - totalSelectedAmount) > 0.01 && (
              <p className="text-sm text-red-500">
                Allocation total ({formatCurrency(totalAllocated)}) does not
                match source total ({formatCurrency(totalSelectedAmount)}).
                Difference: {formatCurrency(totalSelectedAmount - totalAllocated)}
              </p>
            )}

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(2)} data-testid="cip-convert-step3-back-btn">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button
                onClick={() => {
                  if (Math.abs(totalAllocated - totalSelectedAmount) > 0.01) {
                    toast.error(
                      'Component allocations must equal the total selected amount'
                    )
                    return
                  }
                  setStep(4)
                }}
                data-testid="cip-convert-step3-next-btn"
              >
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Review */}
      {step === 4 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 4: Review</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <h3 className="font-medium mb-2">
                Reclassification Journal Entry
              </h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Account</TableHead>
                    <TableHead className="text-right">Debit</TableHead>
                    <TableHead className="text-right">Credit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allocations.map((alloc, i) => {
                    const assetAccount = accountOptions.find(
                      (a) => a.id === alloc.glAssetAccountId
                    )
                    return (
                      <TableRow key={`dr-${i}`}>
                        <TableCell>
                          {assetAccount
                            ? `${assetAccount.code} - ${assetAccount.name}`
                            : 'Unknown'}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(alloc.amount)}
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    )
                  })}
                  {Object.entries(selectedSources)
                    .filter(([, amt]) => Number(amt) > 0)
                    .map(([accountId, amount]) => {
                      const account = cipBalances.subAccounts.find(
                        (s) => s.accountId === Number(accountId)
                      )
                      return (
                        <TableRow key={`cr-${accountId}`}>
                          <TableCell>
                            {account
                              ? `${account.accountCode} - ${account.accountName}`
                              : `Account #${accountId}`}
                          </TableCell>
                          <TableCell />
                          <TableCell className="text-right">
                            {formatCurrency(amount)}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                </TableBody>
              </Table>
            </div>

            <div>
              <h3 className="font-medium mb-2">
                Fixed Assets to be Created ({allocations.length})
              </h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="text-right">Cost</TableHead>
                    <TableHead>Useful Life</TableHead>
                    <TableHead className="text-right">Monthly Depr.</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allocations.map((alloc, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{alloc.name}</TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(alloc.amount)}
                      </TableCell>
                      <TableCell>
                        {Math.floor(alloc.usefulLifeMonths / 12)}yr
                        {alloc.usefulLifeMonths % 12 > 0
                          ? ` ${alloc.usefulLifeMonths % 12}mo`
                          : ''}
                      </TableCell>
                      <TableCell className="text-right">
                        {formatCurrency(
                          Number(alloc.amount) / alloc.usefulLifeMonths
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(3)} data-testid="cip-convert-step4-back-btn">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button onClick={() => setStep(5)} data-testid="cip-convert-proceed-confirm-btn">
                Proceed to Confirm
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Confirm & Execute */}
      {step === 5 && (
        <Card>
          <CardHeader>
            <CardTitle>Step 5: Confirm & Execute</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-muted rounded-lg">
              <p className="font-medium">
                This action will create {allocations.length} fixed asset
                record{allocations.length > 1 ? 's' : ''} and 1 reclassification
                journal entry for {selectedStructure}.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Total amount: {formatCurrency(totalAllocated)}
              </p>
              <p className="text-sm text-muted-foreground">
                Placed in service: {pisDate}
              </p>
            </div>

            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStep(4)} data-testid="cip-convert-step5-back-btn">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
              <Button
                onClick={handleExecute}
                disabled={isPending}
                data-testid="confirm-conversion-btn"
              >
                {isPending ? 'Converting...' : 'Confirm Conversion'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
