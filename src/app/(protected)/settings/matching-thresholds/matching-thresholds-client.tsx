'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { toast } from 'sonner'
import { updateThresholdSettings } from './actions'
import type { ThresholdSettings } from './actions'

interface Props {
  initialSettings: ThresholdSettings
}

export function MatchingThresholdsClient({ initialSettings }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState(initialSettings)
  const [error, setError] = useState<string | null>(null)

  const handleSave = () => {
    setError(null)
    startTransition(async () => {
      try {
        await updateThresholdSettings(form)
        toast.success('Thresholds updated')
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Save failed')
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          Auto-Match Thresholds
        </h1>
        <Button
          onClick={handleSave}
          disabled={isPending}
          data-testid="matching-thresholds-save-btn"
        >
          <Save className="mr-2 h-4 w-4" />
          Save
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive" data-testid="matching-thresholds-error">
          {error}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tier 1: Auto-Match</CardTitle>
          <CardDescription>
            Transactions meeting all these criteria are matched automatically
            without human review.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="autoMatchMinHitCount">
                Min Rule Hit Count
              </Label>
              <Input
                id="autoMatchMinHitCount"
                type="number"
                min={1}
                value={form.autoMatchMinHitCount}
                onChange={(e) =>
                  setForm({ ...form, autoMatchMinHitCount: e.target.value })
                }
                data-testid="matching-thresholds-min-hit-count-input"
              />
              <p className="text-xs text-muted-foreground">
                Rule must have been confirmed at least this many times
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="autoMatchMinConfidence">
                Min Confidence Score
              </Label>
              <Input
                id="autoMatchMinConfidence"
                type="number"
                step="0.01"
                min={0}
                max={2}
                value={form.autoMatchMinConfidence}
                onChange={(e) =>
                  setForm({ ...form, autoMatchMinConfidence: e.target.value })
                }
                data-testid="matching-thresholds-min-confidence-input"
              />
              <p className="text-xs text-muted-foreground">
                Match candidate must score at or above this
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="autoMatchMaxAmount">Max Amount ($)</Label>
              <Input
                id="autoMatchMaxAmount"
                type="number"
                step="0.01"
                min={0}
                value={form.autoMatchMaxAmount}
                onChange={(e) =>
                  setForm({ ...form, autoMatchMaxAmount: e.target.value })
                }
                data-testid="matching-thresholds-max-amount-input"
              />
              <p className="text-xs text-muted-foreground">
                Transactions above this amount require manual review
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Tier 2: Batch Review</CardTitle>
          <CardDescription>
            Transactions meeting this minimum confidence are suggested for batch
            review instead of flagged as exceptions.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="max-w-xs space-y-2">
            <Label htmlFor="reviewMinConfidence">
              Min Review Confidence
            </Label>
            <Input
              id="reviewMinConfidence"
              type="number"
              step="0.01"
              min={0}
              max={2}
              value={form.reviewMinConfidence}
              onChange={(e) =>
                setForm({ ...form, reviewMinConfidence: e.target.value })
              }
              data-testid="matching-thresholds-review-confidence-input"
            />
            <p className="text-xs text-muted-foreground">
              Below this, transactions go to the exception queue (Tier 3)
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
