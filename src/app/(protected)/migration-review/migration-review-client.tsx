'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { CopilotContextSetter } from '@/components/copilot/copilot-context-setter'
import {
  parseAndLoadCsv,
  getReviewItems,
  getReviewSummary,
  resetItem,
  submitFinal,
  deleteBatch,
  type ReviewItemRow,
  type ReviewSummary,
} from './actions'
import type { ReviewRecommendation } from '@/lib/migration/review-engine'

interface Props {
  batchId: string | null
  initialItems: ReviewItemRow[]
  initialSummary: ReviewSummary | null
}

export function MigrationReviewClient({ batchId: initialBatchId, initialItems, initialSummary }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [batchId, setBatchId] = useState(initialBatchId)
  const [items, setItems] = useState(initialItems)
  const [summary, setSummary] = useState(initialSummary)
  const [filter, setFilter] = useState<'all' | 'approved' | 'skipped' | 'pending'>('all')
  const [uploadErrors, setUploadErrors] = useState<string[]>([])
  const [submitResult, setSubmitResult] = useState<{ success: boolean; posted: number; errors: string[] } | null>(null)

  const filteredItems = filter === 'all'
    ? items
    : items.filter((item) => item.status === filter)

  async function handleUpload(formData: FormData) {
    setUploadErrors([])
    startTransition(async () => {
      const result = await parseAndLoadCsv(formData)
      if (result.errors.length > 0) {
        setUploadErrors(result.errors.map((e) => `${e.transactionNo}: ${e.message}`))
        if (result.count === 0) return
      }
      setBatchId(result.batchId)
      const [newItems, newSummary] = await Promise.all([
        getReviewItems(result.batchId),
        getReviewSummary(result.batchId),
      ])
      setItems(newItems)
      setSummary(newSummary)
    })
  }

  async function handleReset(id: number) {
    startTransition(async () => {
      await resetItem(id)
      if (batchId) {
        const [newItems, newSummary] = await Promise.all([
          getReviewItems(batchId),
          getReviewSummary(batchId),
        ])
        setItems(newItems)
        setSummary(newSummary)
      }
    })
  }

  async function handleSubmitFinal() {
    if (!batchId) return
    startTransition(async () => {
      const result = await submitFinal(batchId, 'jeff') // TODO: real userId from auth
      setSubmitResult(result)
      if (result.success) {
        const [newItems, newSummary] = await Promise.all([
          getReviewItems(batchId),
          getReviewSummary(batchId),
        ])
        setItems(newItems)
        setSummary(newSummary)
      }
    })
  }

  async function handleDeleteBatch() {
    if (!batchId) return
    startTransition(async () => {
      await deleteBatch(batchId)
      setBatchId(null)
      setItems([])
      setSummary(null)
      setSubmitResult(null)
    })
  }

  function refreshData() {
    if (!batchId) return
    startTransition(async () => {
      const [newItems, newSummary] = await Promise.all([
        getReviewItems(batchId),
        getReviewSummary(batchId),
      ])
      setItems(newItems)
      setSummary(newSummary)
    })
  }

  return (
    <div className="space-y-6">
      <CopilotContextSetter pageId="migration-review" />

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">QBO Import Review</h1>
        <p className="text-muted-foreground mt-1">
          Upload the QBO Journal CSV, review each transaction, then post to GL.
        </p>
      </div>

      {/* Upload Section — shown when no batch */}
      {!batchId && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upload QBO Journal CSV</CardTitle>
          </CardHeader>
          <CardContent>
            <form action={handleUpload} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="csv">Journal CSV File</Label>
                  <Input
                    id="csv"
                    name="csv"
                    type="file"
                    accept=".csv"
                    required
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="cutoffDate">Cutoff Date</Label>
                  <Input
                    id="cutoffDate"
                    name="cutoffDate"
                    type="date"
                    defaultValue="2025-12-31"
                    className="mt-1"
                  />
                </div>
              </div>
              <Button type="submit" disabled={isPending}>
                {isPending ? 'Parsing...' : 'Parse & Load'}
              </Button>
            </form>
            {uploadErrors.length > 0 && (
              <div className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
                <p className="font-medium">Errors during parse:</p>
                <ul className="mt-1 list-disc pl-4">
                  {uploadErrors.map((e, i) => (
                    <li key={i}>{e}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Batch loaded — show summary + table */}
      {batchId && summary && (
        <>
          {/* Progress & Balance Card */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Progress</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{summary.approved} of {summary.total} approved</p>
                <Progress
                  value={summary.total > 0 ? (summary.approved / summary.total) * 100 : 0}
                  className="mt-2"
                />
                {summary.pending > 0 && (
                  <p className="mt-1 text-xs text-muted-foreground">{summary.pending} pending, {summary.skipped} skipped</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Balance Check</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>Debits</span>
                    <span className="font-mono">${summary.debitsBalance}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Credits</span>
                    <span className="font-mono">${summary.creditsBalance}</span>
                  </div>
                  {summary.debitsBalance === summary.creditsBalance ? (
                    <Badge variant="outline" className="mt-1 border-green-500 text-green-700 dark:text-green-400">Balanced</Badge>
                  ) : (
                    <Badge variant="destructive" className="mt-1">Imbalanced</Badge>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      className="w-full"
                      disabled={isPending || summary.pending > 0}
                    >
                      Submit Final
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Post all approved transactions to GL?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will create {summary.approved} GL transactions with sourceType = FY25_IMPORT. This action cannot be easily undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleSubmitFinal}>Post to GL</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                {summary.pending > 0 && (
                  <p className="text-xs text-muted-foreground text-center">
                    {summary.pending} transactions still need review
                  </p>
                )}
                <Button variant="outline" className="w-full" onClick={refreshData} disabled={isPending}>
                  Refresh
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full" size="sm">
                      Delete Batch
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete this import batch?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will delete all {summary.total} review items. You can re-upload the CSV to start over.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={handleDeleteBatch}>Delete</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardContent>
            </Card>
          </div>

          {/* Submit Result */}
          {submitResult && (
            <Card className={submitResult.success ? 'border-green-500' : 'border-red-500'}>
              <CardContent className="py-4">
                {submitResult.success ? (
                  <p className="text-green-700 dark:text-green-400">
                    Successfully posted {submitResult.posted} transactions to GL.
                  </p>
                ) : (
                  <div>
                    <p className="text-red-700 dark:text-red-300 font-medium">Errors during GL posting:</p>
                    <ul className="mt-1 list-disc pl-4 text-sm text-red-600 dark:text-red-400">
                      {submitResult.errors.map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Filter Tabs + Transaction Table */}
          <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
            <TabsList>
              <TabsTrigger value="all">All ({summary.total})</TabsTrigger>
              <TabsTrigger value="pending">Pending ({summary.pending})</TabsTrigger>
              <TabsTrigger value="approved">Approved ({summary.approved})</TabsTrigger>
              <TabsTrigger value="skipped">Skipped ({summary.skipped})</TabsTrigger>
            </TabsList>

            <TabsContent value={filter} className="mt-4">
              <Card>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-28">Date</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="w-28 text-right">Amount</TableHead>
                      <TableHead className="w-36">Account</TableHead>
                      <TableHead className="w-24">Status</TableHead>
                      <TableHead className="w-20"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredItems.map((item) => {
                      const rec = item.recommendation as ReviewRecommendation
                      const firstAccount = rec.lines[0]
                      return (
                        <TableRow
                          key={item.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => router.push(`/migration-review/${item.id}`)}
                        >
                          <TableCell className="font-mono text-sm">{item.transactionDate}</TableCell>
                          <TableCell className="max-w-xs truncate text-sm">{item.description}</TableCell>
                          <TableCell className="text-right font-mono text-sm">
                            ${Number(item.amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </TableCell>
                          <TableCell className="text-sm">
                            {firstAccount ? `${firstAccount.accountCode} ${firstAccount.accountName}` : '—'}
                            {rec.lines.length > 1 && (
                              <span className="ml-1 text-xs text-muted-foreground">+{rec.lines.length - 1}</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={item.status} />
                          </TableCell>
                          <TableCell>
                            {(item.status === 'approved' || item.status === 'skipped') && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleReset(item.id)
                                }}
                                disabled={isPending}
                              >
                                Reset
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                    {filteredItems.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          No transactions in this filter.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'approved':
      return <Badge variant="outline" className="border-green-500 text-green-700 dark:text-green-400">Approved</Badge>
    case 'skipped':
      return <Badge variant="outline" className="border-amber-500 text-amber-700 dark:text-amber-400">Skipped</Badge>
    case 'pending':
    default:
      return <Badge variant="secondary">Pending</Badge>
  }
}
