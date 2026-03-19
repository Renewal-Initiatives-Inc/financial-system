'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import {
  createRecurringExpectation,
  updateRecurringExpectation,
  deleteRecurringExpectation,
  toggleRecurringExpectation,
} from './actions'
import type { RecurringExpectationRow } from './actions'

interface Props {
  initialExpectations: RecurringExpectationRow[]
  accountOptions: { id: number; name: string; code: string }[]
  fundOptions: { id: number; name: string }[]
  bankAccountOptions: { id: number; name: string }[]
}

const FREQUENCIES = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'biweekly', label: 'Biweekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'annual', label: 'Annual' },
] as const

type Frequency = 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'annual'

const emptyForm = {
  merchantPattern: '',
  description: '',
  expectedAmount: '',
  amountTolerance: '0.00',
  frequency: 'monthly' as Frequency,
  expectedDay: 1,
  glAccountId: 0,
  fundId: 0,
  bankAccountId: 0,
}

export function RecurringExpectationsClient({
  initialExpectations,
  accountOptions,
  fundOptions,
  bankAccountOptions,
}: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [error, setError] = useState<string | null>(null)

  const openCreate = () => {
    setEditingId(null)
    setForm(emptyForm)
    setError(null)
    setDialogOpen(true)
  }

  const openEdit = (row: RecurringExpectationRow) => {
    setEditingId(row.id)
    setForm({
      merchantPattern: row.merchantPattern,
      description: row.description,
      expectedAmount: row.expectedAmount,
      amountTolerance: row.amountTolerance,
      frequency: row.frequency as Frequency,
      expectedDay: row.expectedDay,
      glAccountId: row.glAccountId,
      fundId: row.fundId,
      bankAccountId: row.bankAccountId,
    })
    setError(null)
    setDialogOpen(true)
  }

  const handleSubmit = () => {
    setError(null)

    // Validate regex
    try {
      new RegExp(form.merchantPattern)
    } catch {
      setError('Invalid regex pattern for merchant')
      return
    }

    if (!form.description.trim()) {
      setError('Description is required')
      return
    }

    if (!form.glAccountId || !form.fundId || !form.bankAccountId) {
      setError('Account, fund, and bank account are required')
      return
    }

    const data = {
      ...form,
      expectedDay: Number(form.expectedDay),
      glAccountId: Number(form.glAccountId),
      fundId: Number(form.fundId),
      bankAccountId: Number(form.bankAccountId),
    }

    startTransition(async () => {
      try {
        if (editingId) {
          await updateRecurringExpectation(editingId, data)
          toast.success('Recurring expectation updated')
        } else {
          await createRecurringExpectation(data)
          toast.success('Recurring expectation created')
        }
        setDialogOpen(false)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Save failed')
      }
    })
  }

  const handleDelete = (id: number, description: string) => {
    if (!confirm(`Delete "${description}"?`)) return
    startTransition(async () => {
      try {
        await deleteRecurringExpectation(id)
        toast.success('Deleted')
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Delete failed')
      }
    })
  }

  const handleToggle = (id: number, currentActive: boolean) => {
    startTransition(async () => {
      try {
        await toggleRecurringExpectation(id, !currentActive)
        toast.success(currentActive ? 'Deactivated' : 'Activated')
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Toggle failed')
      }
    })
  }

  const dayLabel = form.frequency === 'weekly' || form.frequency === 'biweekly'
    ? 'Day of Week (1=Mon, 7=Sun)'
    : 'Day of Month (1-31)'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          Recurring Expectations
        </h1>
        <Button
          onClick={openCreate}
          data-testid="recurring-expectations-add-btn"
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Expectation
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Predictable Transactions
          </CardTitle>
        </CardHeader>
        <CardContent>
          {initialExpectations.length === 0 ? (
            <p
              className="text-sm text-muted-foreground text-center py-8"
              data-testid="recurring-expectations-empty"
            >
              No recurring expectations configured. Add known recurring
              transactions to improve auto-matching.
            </p>
          ) : (
            <Table data-testid="recurring-expectations-table">
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Pattern</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Tolerance</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Day</TableHead>
                  <TableHead>Account</TableHead>
                  <TableHead>Fund</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {initialExpectations.map((row) => (
                  <TableRow
                    key={row.id}
                    data-testid={`recurring-expectation-row-${row.id}`}
                  >
                    <TableCell className="font-medium">
                      {row.description}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {row.merchantPattern}
                    </TableCell>
                    <TableCell>${parseFloat(row.expectedAmount).toFixed(2)}</TableCell>
                    <TableCell>±${parseFloat(row.amountTolerance).toFixed(2)}</TableCell>
                    <TableCell className="capitalize">{row.frequency}</TableCell>
                    <TableCell>{row.expectedDay}</TableCell>
                    <TableCell>{row.glAccountName}</TableCell>
                    <TableCell>{row.fundName}</TableCell>
                    <TableCell>
                      <Badge variant={row.isActive ? 'default' : 'secondary'}>
                        {row.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggle(row.id, row.isActive)}
                          disabled={isPending}
                          data-testid={`recurring-expectation-toggle-${row.id}`}
                        >
                          {row.isActive ? (
                            <ToggleRight className="h-4 w-4" />
                          ) : (
                            <ToggleLeft className="h-4 w-4" />
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEdit(row)}
                          disabled={isPending}
                          data-testid={`recurring-expectation-edit-${row.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(row.id, row.description)}
                          disabled={isPending}
                          data-testid={`recurring-expectation-delete-${row.id}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'Edit Recurring Expectation' : 'Add Recurring Expectation'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {error && (
              <p className="text-sm text-destructive" data-testid="recurring-expectation-form-error">
                {error}
              </p>
            )}

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="e.g., Eversource Electric"
                data-testid="recurring-expectation-description-input"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="merchantPattern">Merchant Pattern (regex)</Label>
              <Input
                id="merchantPattern"
                value={form.merchantPattern}
                onChange={(e) => setForm({ ...form, merchantPattern: e.target.value })}
                placeholder="e.g., eversource|ever source"
                className="font-mono text-sm"
                data-testid="recurring-expectation-pattern-input"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="expectedAmount">Expected Amount ($)</Label>
                <Input
                  id="expectedAmount"
                  type="number"
                  step="0.01"
                  value={form.expectedAmount}
                  onChange={(e) => setForm({ ...form, expectedAmount: e.target.value })}
                  data-testid="recurring-expectation-amount-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="amountTolerance">Tolerance ($)</Label>
                <Input
                  id="amountTolerance"
                  type="number"
                  step="0.01"
                  value={form.amountTolerance}
                  onChange={(e) => setForm({ ...form, amountTolerance: e.target.value })}
                  data-testid="recurring-expectation-tolerance-input"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select
                  value={form.frequency}
                  onValueChange={(v) => setForm({ ...form, frequency: v as Frequency })}
                >
                  <SelectTrigger data-testid="recurring-expectation-frequency-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FREQUENCIES.map((f) => (
                      <SelectItem key={f.value} value={f.value}>
                        {f.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="expectedDay">{dayLabel}</Label>
                <Input
                  id="expectedDay"
                  type="number"
                  min={1}
                  max={form.frequency === 'weekly' || form.frequency === 'biweekly' ? 7 : 31}
                  value={form.expectedDay}
                  onChange={(e) => setForm({ ...form, expectedDay: parseInt(e.target.value) || 1 })}
                  data-testid="recurring-expectation-day-input"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>GL Account</Label>
              <Select
                value={form.glAccountId ? String(form.glAccountId) : ''}
                onValueChange={(v) => setForm({ ...form, glAccountId: parseInt(v) })}
              >
                <SelectTrigger data-testid="recurring-expectation-account-select">
                  <SelectValue placeholder="Select account" />
                </SelectTrigger>
                <SelectContent>
                  {accountOptions.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      {a.code} — {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Fund</Label>
              <Select
                value={form.fundId ? String(form.fundId) : ''}
                onValueChange={(v) => setForm({ ...form, fundId: parseInt(v) })}
              >
                <SelectTrigger data-testid="recurring-expectation-fund-select">
                  <SelectValue placeholder="Select fund" />
                </SelectTrigger>
                <SelectContent>
                  {fundOptions.map((f) => (
                    <SelectItem key={f.id} value={String(f.id)}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Bank Account</Label>
              <Select
                value={form.bankAccountId ? String(form.bankAccountId) : ''}
                onValueChange={(v) => setForm({ ...form, bankAccountId: parseInt(v) })}
              >
                <SelectTrigger data-testid="recurring-expectation-bank-account-select">
                  <SelectValue placeholder="Select bank account" />
                </SelectTrigger>
                <SelectContent>
                  {bankAccountOptions.map((b) => (
                    <SelectItem key={b.id} value={String(b.id)}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              data-testid="recurring-expectation-cancel-btn"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isPending}
              data-testid="recurring-expectation-submit-btn"
            >
              {editingId ? 'Save Changes' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
