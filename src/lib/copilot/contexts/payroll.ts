import type { CopilotContextPackage } from '../types'
import { searchTransactionsDefinition, taxLawSearchDefinition } from '../tool-definitions'

export function getPayrollContext(data?: Record<string, unknown>): CopilotContextPackage {
  return {
    pageId: 'payroll',
    pageDescription:
      'User is managing payroll. Help with federal/state withholding, FICA calculations, MA-specific requirements (Circular M, PFML), and payroll journal entries.',
    data: data || {},
    tools: [searchTransactionsDefinition, taxLawSearchDefinition],
    knowledge: ['payroll-tax', 'ma-compliance'],
  }
}
