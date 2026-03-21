import Link from 'next/link'
import { CreditCard, Scale } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

const matchCards = [
  {
    label: 'Match Credit Card Transactions',
    description: 'Categorize and post Ramp transactions to the GL.',
    href: '/expenses/ramp',
    icon: CreditCard,
  },
  {
    label: 'Match Bank Transactions',
    description: 'Categorize and match incoming bank feed transactions to the GL.',
    href: '/match-transactions/bank',
    icon: Scale,
  },
]

export default function MatchTransactionsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Match Transactions
        </h1>
        <p className="text-muted-foreground mt-1">
          Categorize and reconcile transactions against the general ledger.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {matchCards.map((card) => (
          <Link key={card.href} href={card.href}>
            <Card
              className="hover:border-primary/50 transition-colors cursor-pointer h-full"
              data-testid={`match-card-${card.label.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <CardHeader className="flex flex-row items-center gap-3 pb-2">
                <card.icon className="h-5 w-5 text-muted-foreground" />
                <CardTitle className="text-base">{card.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  {card.description}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
