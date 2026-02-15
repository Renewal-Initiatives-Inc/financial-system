import { getAuditLogData } from '@/lib/reports/audit-log'
import { AuditLogClient } from './audit-log-client'

export default async function AuditLogPage() {
  const data = await getAuditLogData()
  return <AuditLogClient initialData={data} />
}
