import {
  REPORT_DEFINITIONS,
  CATEGORY_LABELS,
} from '@/lib/reports/types'
import { ReportList } from './report-list'

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Reports</h1>
        <p className="text-muted-foreground mt-1">
          Financial statements, operational dashboards, and specialized
          reports.
        </p>
      </div>

      <ReportList
        reports={REPORT_DEFINITIONS}
        categoryLabels={CATEGORY_LABELS}
      />
    </div>
  )
}
