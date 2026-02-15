import { eq, and, sql, gte, lte, asc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { complianceDeadlines, tenants } from '@/lib/db/schema'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ComplianceDeadlineRow {
  id: number
  taskName: string
  dueDate: string
  category: string
  recurrence: string
  status: string
  hasReminder30dSent: boolean
  hasReminder7dSent: boolean
  tenantId: number | null
  tenantName: string | null
  notes: string | null
  daysUntilDue: number
  isUpcoming: boolean // within 30 days
  isOverdue: boolean
}

export interface ComplianceCalendarFilters {
  category?: string
  status?: string
  startDate?: string
  endDate?: string
}

export interface ComplianceCalendarData {
  upcoming: ComplianceDeadlineRow[] // next 30 days
  thisQuarter: ComplianceDeadlineRow[] // 31-90 days
  future: ComplianceDeadlineRow[] // 90+ days
  overdue: ComplianceDeadlineRow[] // past due
  totalCount: number
  upcomingCount: number
  overdueCount: number
  generatedAt: string
}

// ---------------------------------------------------------------------------
// Category colors (for client reference)
// ---------------------------------------------------------------------------

export const CATEGORY_COLORS: Record<string, string> = {
  tax: 'bg-blue-100 text-blue-800',
  tenant: 'bg-green-100 text-green-800',
  grant: 'bg-orange-100 text-orange-800',
  budget: 'bg-purple-100 text-purple-800',
}

// ---------------------------------------------------------------------------
// Main query
// ---------------------------------------------------------------------------

export async function getComplianceCalendarData(
  filters?: ComplianceCalendarFilters
): Promise<ComplianceCalendarData> {
  const now = new Date()
  const nowStr = now.toISOString()
  const todayStr = nowStr.split('T')[0]

  const conditions = []

  if (filters?.category) {
    conditions.push(sql`${complianceDeadlines.category} = ${filters.category}`)
  }
  if (filters?.status) {
    conditions.push(sql`${complianceDeadlines.status} = ${filters.status}`)
  }
  if (filters?.startDate) {
    conditions.push(gte(complianceDeadlines.dueDate, filters.startDate))
  }
  if (filters?.endDate) {
    conditions.push(lte(complianceDeadlines.dueDate, filters.endDate))
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  // Get all deadlines with tenant info
  const rows = await db
    .select({
      id: complianceDeadlines.id,
      taskName: complianceDeadlines.taskName,
      dueDate: complianceDeadlines.dueDate,
      category: complianceDeadlines.category,
      recurrence: complianceDeadlines.recurrence,
      status: complianceDeadlines.status,
      hasReminder30dSent: complianceDeadlines.hasReminder30dSent,
      hasReminder7dSent: complianceDeadlines.hasReminder7dSent,
      tenantId: complianceDeadlines.tenantId,
      tenantName: tenants.name,
      notes: complianceDeadlines.notes,
    })
    .from(complianceDeadlines)
    .leftJoin(tenants, eq(complianceDeadlines.tenantId, tenants.id))
    .where(whereClause)
    .orderBy(asc(complianceDeadlines.dueDate))

  // Categorize by time bucket
  const deadlines: ComplianceDeadlineRow[] = rows.map((r) => {
    const dueDate = new Date(r.dueDate + 'T00:00:00')
    const diffMs = dueDate.getTime() - now.getTime()
    const daysUntilDue = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

    return {
      id: r.id,
      taskName: r.taskName,
      dueDate: r.dueDate,
      category: r.category,
      recurrence: r.recurrence,
      status: r.status,
      hasReminder30dSent: r.hasReminder30dSent,
      hasReminder7dSent: r.hasReminder7dSent,
      tenantId: r.tenantId,
      tenantName: r.tenantName,
      notes: r.notes,
      daysUntilDue,
      isUpcoming: daysUntilDue >= 0 && daysUntilDue <= 30,
      isOverdue: daysUntilDue < 0 && r.status !== 'completed',
    }
  })

  const overdue = deadlines.filter((d) => d.isOverdue)
  const upcoming = deadlines.filter((d) => d.isUpcoming && !d.isOverdue)
  const thisQuarter = deadlines.filter(
    (d) => d.daysUntilDue > 30 && d.daysUntilDue <= 90 && !d.isOverdue
  )
  const future = deadlines.filter((d) => d.daysUntilDue > 90)

  return {
    upcoming,
    thisQuarter,
    future,
    overdue,
    totalCount: deadlines.length,
    upcomingCount: upcoming.length,
    overdueCount: overdue.length,
    generatedAt: nowStr,
  }
}
