'use client'

import { createInvoice } from '../../../../actions'
import { toast } from 'sonner'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const fmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
})

interface CreateInvoiceFormProps {
  po: {
    id: number
    vendorId: number
    vendorName: string
    description: string
    totalAmount: string
    invoicedAmount: string
    fundName: string
    accountCode: string
    accountName: string
    cipCostCodeName: string | null
  }
}

export function CreateInvoiceForm({ po }: CreateInvoiceFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [invoiceNumber, setInvoiceNumber] = useState('')
  const [amount, setAmount] = useState('')
  const [invoiceDate, setInvoiceDate] = useState('')
  const [dueDate, setDueDate] = useState('')

  const total = parseFloat(po.totalAmount)
  const invoiced = parseFloat(po.invoicedAmount)
  const remaining = total - invoiced
  const parsedAmount = parseFloat(amount) || 0
  const wouldExceed = parsedAmount > 0 && parsedAmount > remaining

  const handleSubmit = () => {
    if (!amount || parsedAmount <= 0) {
      toast.error('Please enter a valid amount')
      return
    }
    if (!invoiceDate) {
      toast.error('Please select an invoice date')
      return
    }

    startTransition(async () => {
      try {
        const result = await createInvoice(
          {
            purchaseOrderId: po.id,
            vendorId: po.vendorId,
            invoiceNumber: invoiceNumber.trim() || undefined,
            amount: parseFloat(amount),
            invoiceDate,
            dueDate: dueDate || undefined,
          },
          'system'
        )
        toast.success(
          `Invoice posted — GL entry #${result.glTransactionId} created`
        )
        router.push(`/expenses/purchase-orders/${po.id}`)
      } catch (err) {
        if (err instanceof Error) {
          toast.error(err.message)
        } else {
          toast.error('Failed to create invoice')
        }
      }
    })
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Post Invoice</h1>
        <Button variant="outline" asChild>
          <Link href={`/expenses/purchase-orders/${po.id}`}>Cancel</Link>
        </Button>
      </div>

      {/* PO Context */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Purchase Order Context</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-x-4 gap-y-2">
            <div className="text-muted-foreground">PO Number</div>
            <div className="font-medium">PO-{po.id}</div>

            <div className="text-muted-foreground">Vendor</div>
            <div className="font-medium">{po.vendorName}</div>

            <div className="text-muted-foreground">Description</div>
            <div className="font-medium">{po.description}</div>
          </div>

          <div className="border-t pt-3">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-muted-foreground text-xs">Total</div>
                <div className="font-semibold">{fmt.format(total)}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Invoiced</div>
                <div className="font-semibold">{fmt.format(invoiced)}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-xs">Remaining</div>
                <div
                  className={`font-semibold ${remaining < 0 ? 'text-destructive' : ''}`}
                >
                  {fmt.format(remaining)}
                </div>
              </div>
            </div>
          </div>

          <div className="border-t pt-3">
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">Fund: {po.fundName}</Badge>
              <Badge variant="outline">
                GL: {po.accountCode} - {po.accountName}
              </Badge>
              {po.cipCostCodeName && (
                <Badge variant="outline">
                  CIP Cost Code: {po.cipCostCodeName}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invoice Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invoice Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-2">
            <Label htmlFor="invoice-number">
              Invoice Number{' '}
              <span className="text-muted-foreground text-xs font-normal">
                (vendor reference, optional)
              </span>
            </Label>
            <Input
              id="invoice-number"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              placeholder="e.g. INV-2024-001"
              data-testid="invoice-number"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="invoice-amount">
              Amount <span className="text-destructive">*</span>
            </Label>
            <Input
              id="invoice-amount"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              data-testid="invoice-amount"
            />
            {wouldExceed && (
              <p className="text-sm text-amber-600">
                Warning: This amount would make total invoiced (
                {fmt.format(invoiced + parsedAmount)}) exceed the PO total (
                {fmt.format(total)}).
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="invoice-date">
                Invoice Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="invoice-date"
                type="date"
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                data-testid="invoice-date"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="invoice-due-date">Due Date</Label>
              <Input
                id="invoice-due-date"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                data-testid="invoice-due-date"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" asChild>
          <Link href={`/expenses/purchase-orders/${po.id}`}>Cancel</Link>
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={isPending}
          data-testid="invoice-submit-btn"
        >
          {isPending ? 'Posting...' : 'Post Invoice'}
        </Button>
      </div>
    </div>
  )
}
