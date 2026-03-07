import { redirect } from 'next/navigation'

// The payroll runs list lives at /payroll (not /payroll/runs).
// This redirect ensures breadcrumb links from /payroll/runs/new
// and /payroll/runs/[id] don't 404.
export default function PayrollRunsPage() {
  redirect('/payroll')
}
