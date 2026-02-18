'use client'

import Link from 'next/link'
import { FileText, Lock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { ReportCardDef } from '@/lib/reports/types'

const CATEGORIES = [
  'core',
  'operational',
  'fund',
  'specialized',
  'compliance',
  'payroll',
] as const

export function ReportList({
  reports,
  categoryLabels,
}: {
  reports: ReportCardDef[]
  categoryLabels: Record<string, string>
}) {
  return (
    <TooltipProvider>
      <div className="space-y-6">
        {CATEGORIES.map((cat) => {
          const catReports = reports.filter((r) => r.category === cat)
          if (catReports.length === 0) return null

          const leftCol = catReports.slice(
            0,
            Math.ceil(catReports.length / 2)
          )
          const rightCol = catReports.slice(Math.ceil(catReports.length / 2))

          return (
            <section key={cat}>
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                {categoryLabels[cat]}
              </h2>
              <div className="rounded-lg border bg-card">
                <div className="grid grid-cols-1 lg:grid-cols-2 lg:divide-x">
                  <div className="divide-y">
                    {leftCol.map((report) => (
                      <ReportRow key={report.slug} report={report} />
                    ))}
                  </div>
                  <div className="divide-y">
                    {rightCol.map((report) => (
                      <ReportRow key={report.slug} report={report} />
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )
        })}
      </div>
    </TooltipProvider>
  )
}

function ReportRow({ report }: { report: ReportCardDef }) {
  if (!report.isAvailable) {
    return (
      <div className="flex items-center gap-2.5 px-4 py-2.5 text-muted-foreground/50">
        <Lock className="h-3.5 w-3.5 shrink-0" />
        <span className="text-sm">{report.title}</span>
        <Badge
          variant="outline"
          className="ml-auto text-[10px] px-1.5 py-0 opacity-50 font-normal"
        >
          Soon
        </Badge>
      </div>
    )
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Link
          href={`/reports/${report.slug}`}
          className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-accent transition-colors"
        >
          <FileText className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <span className="text-sm font-medium text-foreground">
            {report.title}
          </span>
        </Link>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs">
        <p>{report.description}</p>
      </TooltipContent>
    </Tooltip>
  )
}
