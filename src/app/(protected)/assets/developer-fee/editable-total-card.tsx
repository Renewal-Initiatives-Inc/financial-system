'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Check, Pencil, X } from 'lucide-react'
import { toast } from 'sonner'
import { updateTotalDeveloperFee } from './actions'

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value)
}

export function EditableTotalCard({ initialValue }: { initialValue: number }) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [editing, setEditing] = useState(false)
  const [editValue, setEditValue] = useState(String(initialValue))

  const handleSave = () => {
    const parsed = parseFloat(editValue.replace(/,/g, ''))
    if (isNaN(parsed) || parsed <= 0) {
      toast.error('Enter a valid positive amount')
      return
    }
    startTransition(async () => {
      try {
        await updateTotalDeveloperFee(parsed)
        toast.success('Total developer fee updated')
        setEditing(false)
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to update')
      }
    })
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          Total Developer Fee
        </CardTitle>
      </CardHeader>
      <CardContent>
        {editing ? (
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold">$</span>
            <Input
              type="text"
              inputMode="decimal"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="text-lg font-bold w-40"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave()
                if (e.key === 'Escape') { setEditing(false); setEditValue(String(initialValue)) }
              }}
              data-testid="dev-fee-total-input"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSave}
              disabled={isPending}
              data-testid="dev-fee-total-save"
            >
              <Check className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setEditing(false); setEditValue(String(initialValue)) }}
              disabled={isPending}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-2xl font-bold">{formatCurrency(initialValue)}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setEditValue(String(initialValue)); setEditing(true) }}
              title="Edit total developer fee"
              data-testid="dev-fee-total-edit"
            >
              <Pencil className="h-3 w-3" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
