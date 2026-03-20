'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Landmark, HardHat, DollarSign, Clock } from 'lucide-react'

const assetCards = [
  {
    label: 'Fixed Assets',
    description: 'Manage fixed assets, depreciation, and CIP conversions.',
    href: '/assets/fixed',
    icon: Landmark,
  },
  {
    label: 'CIP Balances',
    description: 'Construction in progress — track costs before capitalization.',
    href: '/assets/cip',
    icon: HardHat,
  },
  {
    label: 'Developer Fee',
    description: 'Developer fee allocation and tracking.',
    href: '/assets/developer-fee',
    icon: DollarSign,
  },
  {
    label: 'Prepaid Expenses',
    description: 'Prepaid schedules and amortization.',
    href: '/assets/prepaid',
    icon: Clock,
  },
]

export function AssetListClient() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Assets</h1>
        <p className="text-muted-foreground mt-1">
          Fixed assets, construction in progress, and prepaid expenses.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {assetCards.map((card) => (
          <Link key={card.href} href={card.href}>
            <Card
              className="hover:border-primary/50 transition-colors cursor-pointer h-full"
              data-testid={`asset-card-${card.label.toLowerCase().replace(/\s+/g, '-')}`}
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
