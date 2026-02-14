import Link from 'next/link'
import { FileText, Lock } from 'lucide-react'
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  REPORT_DEFINITIONS,
  CATEGORY_LABELS,
  type ReportCardDef,
} from '@/lib/reports/types'

export default function ReportsPage() {
  const categories = ['core', 'operational', 'fund', 'specialized'] as const

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="text-muted-foreground mt-1">
          Financial statements, operational dashboards, and specialized reports.
        </p>
      </div>

      {categories.map((cat) => {
        const reports = REPORT_DEFINITIONS.filter((r) => r.category === cat)
        if (reports.length === 0) return null

        return (
          <section key={cat}>
            <h2 className="text-lg font-semibold mb-3">{CATEGORY_LABELS[cat]}</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {reports.map((report) => (
                <ReportCard key={report.slug} report={report} />
              ))}
            </div>
          </section>
        )
      })}
    </div>
  )
}

function ReportCard({ report }: { report: ReportCardDef }) {
  if (!report.isAvailable) {
    return (
      <Card className="opacity-60">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">{report.title}</CardTitle>
            <Badge variant="outline" className="text-xs">
              <Lock className="h-3 w-3 mr-1" />
              Coming Soon
            </Badge>
          </div>
          <CardDescription className="text-xs">{report.description}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Link href={`/reports/${report.slug}`}>
      <Card className="hover:border-primary/50 hover:shadow-sm transition-all cursor-pointer h-full">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
            <CardTitle className="text-sm font-medium">{report.title}</CardTitle>
          </div>
          <CardDescription className="text-xs">{report.description}</CardDescription>
        </CardHeader>
      </Card>
    </Link>
  )
}
