import Link from 'next/link'
import { FileText, CreditCard, Receipt } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function ExpensesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Expenses</h1>
        <p className="text-muted-foreground mt-1">
          Manage purchase orders, invoices, and payables.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link href="/expenses/purchase-orders">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Purchase Orders</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Create and manage vendor contracts, track invoices and budget
                capacity.
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/expenses/payables">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <Receipt className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">
                Outstanding Payables
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                View all unpaid amounts — AP, reimbursements, and credit card
                balances.
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/expenses/ramp">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <CreditCard className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Ramp Credit Card</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Categorize and post Ramp credit card transactions to the GL.
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
