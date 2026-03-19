import Link from 'next/link'
import { ArrowRight, Clock, Database, DollarSign } from 'lucide-react'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-2">
          System configuration and integrations.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Link href="/settings/staging" data-testid="settings-staging-link">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardHeader>
              <div className="flex items-center justify-between">
                <Database className="text-muted-foreground h-5 w-5" />
                <ArrowRight className="text-muted-foreground h-4 w-4" />
              </div>
              <CardTitle className="text-base">Staging Records</CardTitle>
              <CardDescription>
                View and manage records from renewal-timesheets and
                expense-reports.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/settings/data-retention" data-testid="settings-data-retention-link">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardHeader>
              <div className="flex items-center justify-between">
                <Clock className="text-muted-foreground h-5 w-5" />
                <ArrowRight className="text-muted-foreground h-4 w-4" />
              </div>
              <CardTitle className="text-base">Data Retention</CardTitle>
              <CardDescription>
                Review record age by category for annual retention compliance.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>

        <Link href="/settings/cash-thresholds" data-testid="settings-cash-thresholds-link">
          <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
            <CardHeader>
              <div className="flex items-center justify-between">
                <DollarSign className="text-muted-foreground h-5 w-5" />
                <ArrowRight className="text-muted-foreground h-4 w-4" />
              </div>
              <CardTitle className="text-base">Cash Forecast Thresholds</CardTitle>
              <CardDescription>
                Set warning and critical levels for unrestricted cash alerts in
                the 13-week forecast.
              </CardDescription>
            </CardHeader>
          </Card>
        </Link>
      </div>
    </div>
  )
}
