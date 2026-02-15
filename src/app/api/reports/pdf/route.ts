import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import {
  ReportDocument,
  PDFTableHeader,
  PDFTableRow,
  PDFSectionDivider,
} from '@/lib/reports/pdf/report-document'
import { formatCurrency, formatPercent } from '@/lib/reports/types'
import { auth } from '@/lib/auth'

// Dynamic PDF generation route
// Accepts: ?report=balance-sheet&startDate=...&endDate=...&fundId=...
// Returns: PDF download

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const params = request.nextUrl.searchParams
  const reportSlug = params.get('report')

  if (!reportSlug) {
    return NextResponse.json(
      { error: 'Missing report parameter' },
      { status: 400 }
    )
  }

  try {
    const pdfBuffer = await generateReportPDF(reportSlug, params)

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${reportSlug}-${new Date().toISOString().split('T')[0]}.pdf"`,
      },
    })
  } catch (error) {
    console.error('PDF generation error:', error)
    return NextResponse.json(
      { error: 'PDF generation failed' },
      { status: 500 }
    )
  }
}

// Helper: shorthand for React.createElement
// react-pdf Style types are incompatible with React DOM CSSProperties at the type level,
// but work correctly at runtime. Using 'any' for the createElement wrapper.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const el: (...args: any[]) => any = React.createElement

async function generateReportPDF(
  reportSlug: string,
  params: URLSearchParams
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
  const endDate =
    params.get('endDate') ?? new Date().toISOString().split('T')[0]
  const startDate =
    params.get('startDate') ?? `${endDate.substring(0, 4)}-01-01`
  const fundIdStr = params.get('fundId')
  const fundId = fundIdStr ? parseInt(fundIdStr) : undefined

  switch (reportSlug) {
    // -----------------------------------------------------------------------
    // Report #1: Balance Sheet
    // -----------------------------------------------------------------------
    case 'balance-sheet': {
      const { getBalanceSheetData } = await import(
        '@/lib/reports/balance-sheet'
      )
      const data = await getBalanceSheetData({ endDate, fundId })
      return renderToBuffer(
        el(
          ReportDocument,
          {
            title: 'Statement of Financial Position',
            dateRange: `As of ${endDate}`,
            fundName: data.fundName,
          },
          el(PDFTableHeader, {
            columns: [{ label: 'Account' }, { label: 'Balance' }],
          }),
          el(PDFTableRow, {
            cells: ['ASSETS', ''],
            isSectionHeader: true,
          }),
          el(PDFTableRow, {
            cells: ['Current Assets', ''],
            isSectionHeader: true,
          }),
          ...data.currentAssets.rows.map((r) =>
            el(PDFTableRow, {
              key: `ca-${r.accountId}`,
              cells: [
                `  ${r.accountCode} — ${r.accountName}`,
                formatCurrency(r.balance),
              ],
              indent: 1,
            })
          ),
          el(PDFTableRow, {
            cells: [
              'Total Current Assets',
              formatCurrency(data.currentAssets.total),
            ],
            isBold: true,
          }),
          el(PDFTableRow, {
            cells: ['Noncurrent Assets', ''],
            isSectionHeader: true,
          }),
          ...data.noncurrentAssets.rows.map((r) =>
            el(PDFTableRow, {
              key: `na-${r.accountId}`,
              cells: [
                `  ${r.accountCode} — ${r.accountName}`,
                formatCurrency(r.balance),
              ],
              indent: 1,
            })
          ),
          el(PDFTableRow, {
            cells: [
              'Total Noncurrent Assets',
              formatCurrency(data.noncurrentAssets.total),
            ],
            isBold: true,
          }),
          el(PDFTableRow, {
            cells: ['TOTAL ASSETS', formatCurrency(data.totalAssets)],
            isBold: true,
          }),
          el(PDFSectionDivider),
          el(PDFTableRow, {
            cells: ['LIABILITIES', ''],
            isSectionHeader: true,
          }),
          ...data.currentLiabilities.rows.map((r) =>
            el(PDFTableRow, {
              key: `cl-${r.accountId}`,
              cells: [
                `  ${r.accountCode} — ${r.accountName}`,
                formatCurrency(r.balance),
              ],
              indent: 1,
            })
          ),
          el(PDFTableRow, {
            cells: [
              'Total Current Liabilities',
              formatCurrency(data.currentLiabilities.total),
            ],
            isBold: true,
          }),
          ...data.longTermLiabilities.rows.map((r) =>
            el(PDFTableRow, {
              key: `lt-${r.accountId}`,
              cells: [
                `  ${r.accountCode} — ${r.accountName}`,
                formatCurrency(r.balance),
              ],
              indent: 1,
            })
          ),
          el(PDFTableRow, {
            cells: [
              'Total Long-Term Liabilities',
              formatCurrency(data.longTermLiabilities.total),
            ],
            isBold: true,
          }),
          el(PDFTableRow, {
            cells: [
              'TOTAL LIABILITIES',
              formatCurrency(data.totalLiabilities),
            ],
            isBold: true,
          }),
          el(PDFSectionDivider),
          el(PDFTableRow, {
            cells: ['NET ASSETS', ''],
            isSectionHeader: true,
          }),
          ...data.netAssetsUnrestricted.rows.map((r) =>
            el(PDFTableRow, {
              key: `nu-${r.accountId}`,
              cells: [
                `  ${r.accountCode} — ${r.accountName}`,
                formatCurrency(r.balance),
              ],
              indent: 1,
            })
          ),
          el(PDFTableRow, {
            cells: [
              'Without Donor Restrictions',
              formatCurrency(data.netAssetsUnrestricted.total),
            ],
            isBold: true,
          }),
          ...data.netAssetsRestricted.rows.map((r) =>
            el(PDFTableRow, {
              key: `nr-${r.accountId}`,
              cells: [
                `  ${r.accountCode} — ${r.accountName}`,
                formatCurrency(r.balance),
              ],
              indent: 1,
            })
          ),
          el(PDFTableRow, {
            cells: [
              'With Donor Restrictions',
              formatCurrency(data.netAssetsRestricted.total),
            ],
            isBold: true,
          }),
          el(PDFTableRow, {
            cells: [
              'TOTAL NET ASSETS',
              formatCurrency(data.totalNetAssets),
            ],
            isBold: true,
          }),
          el(PDFTableRow, {
            cells: [
              'TOTAL LIABILITIES & NET ASSETS',
              formatCurrency(data.totalLiabilitiesAndNetAssets),
            ],
            isBold: true,
          })
        )
      )
    }

    // -----------------------------------------------------------------------
    // Report #2: Statement of Activities (P&L)
    // -----------------------------------------------------------------------
    case 'activities': {
      const { getActivitiesData } = await import('@/lib/reports/activities')
      const data = await getActivitiesData({ startDate, endDate, fundId })
      const cols = [
        { label: 'Account' },
        { label: 'Current Period' },
        { label: 'YTD' },
        { label: 'Budget' },
      ]
      return renderToBuffer(
        el(
          ReportDocument,
          {
            title: 'Statement of Activities',
            dateRange: `${startDate} to ${endDate}`,
            fundName: data.fundName,
          },
          el(PDFTableHeader, { columns: cols }),
          el(PDFTableRow, {
            cells: ['REVENUE', '', '', ''],
            isSectionHeader: true,
          }),
          ...data.revenueSections.flatMap((s) => [
            el(PDFTableRow, {
              key: `rh-${s.title}`,
              cells: [s.title, '', '', ''],
              isSectionHeader: true,
            }),
            ...s.rows.map((r) =>
              el(PDFTableRow, {
                key: `r-${r.accountId}`,
                cells: [
                  `  ${r.accountCode} — ${r.accountName}`,
                  formatCurrency(r.currentPeriod),
                  formatCurrency(r.yearToDate),
                  r.budget !== null ? formatCurrency(r.budget) : '—',
                ],
                indent: 1,
              })
            ),
            el(PDFTableRow, {
              key: `rt-${s.title}`,
              cells: [
                `Total ${s.title}`,
                formatCurrency(s.total.currentPeriod),
                formatCurrency(s.total.yearToDate),
                s.total.budget !== null ? formatCurrency(s.total.budget) : '—',
              ],
              isBold: true,
            }),
          ]),
          el(PDFTableRow, {
            cells: [
              'TOTAL REVENUE',
              formatCurrency(data.totalRevenue.currentPeriod),
              formatCurrency(data.totalRevenue.yearToDate),
              data.totalRevenue.budget !== null
                ? formatCurrency(data.totalRevenue.budget)
                : '—',
            ],
            isBold: true,
          }),
          el(PDFSectionDivider),
          el(PDFTableRow, {
            cells: ['EXPENSES', '', '', ''],
            isSectionHeader: true,
          }),
          ...data.expenseSections.flatMap((s) => [
            el(PDFTableRow, {
              key: `eh-${s.title}`,
              cells: [s.title, '', '', ''],
              isSectionHeader: true,
            }),
            ...s.rows.map((r) =>
              el(PDFTableRow, {
                key: `e-${r.accountId}`,
                cells: [
                  `  ${r.accountCode} — ${r.accountName}`,
                  formatCurrency(r.currentPeriod),
                  formatCurrency(r.yearToDate),
                  r.budget !== null ? formatCurrency(r.budget) : '—',
                ],
                indent: 1,
              })
            ),
            el(PDFTableRow, {
              key: `et-${s.title}`,
              cells: [
                `Total ${s.title}`,
                formatCurrency(s.total.currentPeriod),
                formatCurrency(s.total.yearToDate),
                s.total.budget !== null ? formatCurrency(s.total.budget) : '—',
              ],
              isBold: true,
            }),
          ]),
          el(PDFTableRow, {
            cells: [
              'TOTAL EXPENSES',
              formatCurrency(data.totalExpenses.currentPeriod),
              formatCurrency(data.totalExpenses.yearToDate),
              data.totalExpenses.budget !== null
                ? formatCurrency(data.totalExpenses.budget)
                : '—',
            ],
            isBold: true,
          }),
          el(PDFSectionDivider),
          el(PDFTableRow, {
            cells: [
              'Net Asset Releases',
              formatCurrency(data.netAssetReleases.currentPeriod),
              formatCurrency(data.netAssetReleases.yearToDate),
              '—',
            ],
          }),
          el(PDFTableRow, {
            cells: [
              'CHANGE IN NET ASSETS',
              formatCurrency(data.changeInNetAssets.currentPeriod),
              formatCurrency(data.changeInNetAssets.yearToDate),
              data.changeInNetAssets.budget !== null
                ? formatCurrency(data.changeInNetAssets.budget)
                : '—',
            ],
            isBold: true,
          })
        )
      )
    }

    // -----------------------------------------------------------------------
    // Report #3: Statement of Cash Flows
    // -----------------------------------------------------------------------
    case 'cash-flows': {
      const { getCashFlows } = await import('@/lib/reports/cash-flows')
      const data = await getCashFlows({ startDate, endDate, fundId })
      return renderToBuffer(
        el(
          ReportDocument,
          {
            title: 'Statement of Cash Flows',
            dateRange: `${startDate} to ${endDate}`,
            fundName: data.fundName,
          },
          el(PDFTableHeader, {
            columns: [{ label: 'Description' }, { label: 'Amount' }],
          }),
          ...[data.operating, data.investing, data.financing].flatMap((s) => [
            el(PDFTableRow, {
              key: `sh-${s.title}`,
              cells: [s.title, ''],
              isSectionHeader: true,
            }),
            ...s.lines.map((l, i) =>
              el(PDFTableRow, {
                key: `${s.title}-${i}`,
                cells: [l.label, formatCurrency(l.amount)],
                indent: l.indent,
                isBold: l.isSubtotal || l.isTotal,
              })
            ),
            el(PDFTableRow, {
              key: `st-${s.title}`,
              cells: [`Net Cash from ${s.title}`, formatCurrency(s.subtotal)],
              isBold: true,
            }),
            el(PDFSectionDivider, { key: `sd-${s.title}` }),
          ]),
          el(PDFTableRow, {
            cells: [
              'NET CHANGE IN CASH',
              formatCurrency(data.netChangeInCash),
            ],
            isBold: true,
          }),
          el(PDFTableRow, {
            cells: ['Beginning Cash', formatCurrency(data.beginningCash)],
          }),
          el(PDFTableRow, {
            cells: ['ENDING CASH', formatCurrency(data.endingCash)],
            isBold: true,
          })
        )
      )
    }

    // -----------------------------------------------------------------------
    // Report #4: Statement of Functional Expenses
    // -----------------------------------------------------------------------
    case 'functional-expenses': {
      const { getFunctionalExpensesData } = await import(
        '@/lib/reports/functional-expenses'
      )
      const format =
        (params.get('format') as 'gaap' | '990') ?? 'gaap'
      const data = await getFunctionalExpensesData({
        startDate,
        endDate,
        fundId,
        format,
      })
      const hasFR = data.hasUnallocated
      const cols = [
        { label: 'Expense' },
        { label: 'Total' },
        { label: 'Program' },
        { label: 'M&G' },
        { label: 'Fundraising' },
        ...(hasFR ? [{ label: 'Unalloc.' }] : []),
      ]
      return renderToBuffer(
        el(
          ReportDocument,
          {
            title: `Statement of Functional Expenses (${data.format.toUpperCase()})`,
            dateRange: `${startDate} to ${endDate}`,
            fundName: data.fundName,
          },
          el(PDFTableHeader, { columns: cols }),
          ...data.rows.map((r, i) =>
            el(PDFTableRow, {
              key: `fe-${i}`,
              cells: [
                r.label,
                formatCurrency(r.total),
                formatCurrency(r.program),
                formatCurrency(r.admin),
                formatCurrency(r.fundraising),
                ...(hasFR ? [formatCurrency(r.unallocated)] : []),
              ],
              isSectionHeader: r.isGroupHeader,
              isBold: r.isTotal,
            })
          ),
          el(PDFSectionDivider),
          el(PDFTableRow, {
            cells: [
              'TOTAL',
              formatCurrency(data.totals.total),
              formatCurrency(data.totals.program),
              formatCurrency(data.totals.admin),
              formatCurrency(data.totals.fundraising),
              ...(hasFR ? [formatCurrency(data.totals.unallocated)] : []),
            ],
            isBold: true,
          })
        )
      )
    }

    // -----------------------------------------------------------------------
    // Report #5: Cash Position Summary
    // -----------------------------------------------------------------------
    case 'cash-position': {
      const { getCashPositionData } = await import(
        '@/lib/reports/cash-position'
      )
      const data = await getCashPositionData()
      const sections = [data.cashSection, data.payablesSection, data.receivablesSection]
      return renderToBuffer(
        el(
          ReportDocument,
          {
            title: 'Cash Position Summary',
            dateRange: `As of ${endDate}`,
          },
          el(PDFTableHeader, {
            columns: [{ label: 'Account' }, { label: 'Balance' }],
          }),
          ...sections.flatMap((s) => [
            el(PDFTableRow, {
              key: `sh-${s.title}`,
              cells: [s.title, ''],
              isSectionHeader: true,
            }),
            ...s.accounts.map((a) =>
              el(PDFTableRow, {
                key: `cp-${a.accountId}`,
                cells: [
                  `  ${a.accountCode} — ${a.accountName}`,
                  formatCurrency(a.balance),
                ],
                indent: 1,
              })
            ),
            el(PDFTableRow, {
              key: `st-${s.title}`,
              cells: [`Total ${s.title}`, formatCurrency(s.total)],
              isBold: true,
            }),
          ]),
          el(PDFSectionDivider),
          el(PDFTableRow, {
            cells: [
              'NET AVAILABLE CASH',
              formatCurrency(data.netAvailableCash),
            ],
            isBold: true,
          }),
          ...(data.ahpStatus
            ? [
                el(PDFSectionDivider, { key: 'ahp-div' }),
                el(PDFTableRow, {
                  key: 'ahp-h',
                  cells: ['AHP Line of Credit', ''],
                  isSectionHeader: true,
                }),
                el(PDFTableRow, {
                  key: 'ahp-lim',
                  cells: [
                    '  Credit Limit',
                    formatCurrency(data.ahpStatus.creditLimit),
                  ],
                  indent: 1,
                }),
                el(PDFTableRow, {
                  key: 'ahp-drawn',
                  cells: [
                    '  Drawn',
                    formatCurrency(data.ahpStatus.drawn),
                  ],
                  indent: 1,
                }),
                el(PDFTableRow, {
                  key: 'ahp-avail',
                  cells: [
                    '  Available',
                    formatCurrency(data.ahpStatus.available),
                  ],
                  isBold: true,
                  indent: 1,
                }),
              ]
            : [])
        )
      )
    }

    // -----------------------------------------------------------------------
    // Report #6: AR Aging
    // -----------------------------------------------------------------------
    case 'ar-aging': {
      const { getARAgingData } = await import('@/lib/reports/ar-aging')
      const data = await getARAgingData()
      const agingCols = [
        { label: 'Name' },
        { label: 'Current' },
        { label: '31-60' },
        { label: '61-90' },
        { label: '90+' },
        { label: 'Total' },
      ]
      function agingCells(
        label: string,
        b: {
          current: number
          days31to60: number
          days61to90: number
          days90plus: number
          total: number
        }
      ) {
        return [
          label,
          formatCurrency(b.current),
          formatCurrency(b.days31to60),
          formatCurrency(b.days61to90),
          formatCurrency(b.days90plus),
          formatCurrency(b.total),
        ]
      }
      return renderToBuffer(
        el(
          ReportDocument,
          { title: 'Accounts Receivable Aging', dateRange: `As of ${endDate}` },
          el(PDFTableHeader, { columns: agingCols }),
          // Tenant AR
          el(PDFTableRow, {
            cells: ['TENANT AR', '', '', '', '', ''],
            isSectionHeader: true,
          }),
          ...data.tenantAR.rows.map((r) =>
            el(PDFTableRow, {
              key: `tar-${r.tenantId}`,
              cells: agingCells(
                `${r.tenantName} (${r.unitNumber})${r.isVASH ? ' [VASH]' : ''}`,
                r.aging
              ),
              indent: 1,
            })
          ),
          el(PDFTableRow, {
            cells: agingCells('Total Tenant AR', data.tenantAR.total),
            isBold: true,
          }),
          // Grant AR
          el(PDFTableRow, {
            cells: ['GRANT AR', '', '', '', '', ''],
            isSectionHeader: true,
          }),
          ...data.grantAR.rows.map((r) =>
            el(PDFTableRow, {
              key: `gar-${r.grantId}`,
              cells: agingCells(r.funderName, r.aging),
              indent: 1,
            })
          ),
          el(PDFTableRow, {
            cells: agingCells('Total Grant AR', data.grantAR.total),
            isBold: true,
          }),
          // Pledge AR
          el(PDFTableRow, {
            cells: ['PLEDGE AR', '', '', '', '', ''],
            isSectionHeader: true,
          }),
          ...data.pledgeAR.rows.map((r) =>
            el(PDFTableRow, {
              key: `par-${r.pledgeId}`,
              cells: agingCells(r.donorName, r.aging),
              indent: 1,
            })
          ),
          el(PDFTableRow, {
            cells: agingCells('Total Pledge AR', data.pledgeAR.total),
            isBold: true,
          }),
          el(PDFSectionDivider),
          el(PDFTableRow, {
            cells: agingCells('GRAND TOTAL', data.grandTotal),
            isBold: true,
          })
        )
      )
    }

    // -----------------------------------------------------------------------
    // Report #7: Outstanding Payables
    // -----------------------------------------------------------------------
    case 'outstanding-payables': {
      const { getOutstandingPayablesData } = await import(
        '@/lib/reports/outstanding-payables'
      )
      const data = await getOutstandingPayablesData()
      return renderToBuffer(
        el(
          ReportDocument,
          {
            title: 'Outstanding Payables',
            dateRange: `As of ${endDate}`,
          },
          el(PDFTableHeader, {
            columns: [
              { label: 'Description' },
              { label: 'Vendor' },
              { label: 'Amount' },
              { label: 'Aging' },
            ],
          }),
          ...data.sections.flatMap((s) => [
            el(PDFTableRow, {
              key: `ps-${s.title}`,
              cells: [s.title, '', '', ''],
              isSectionHeader: true,
            }),
            ...s.rows.map((r, i) =>
              el(PDFTableRow, {
                key: `pr-${s.title}-${i}`,
                cells: [
                  r.invoiceNumber
                    ? `Inv #${r.invoiceNumber}${r.poNumber ? ` (PO ${r.poNumber})` : ''}`
                    : r.type,
                  r.vendorName ?? '',
                  formatCurrency(r.amount),
                  r.agingBucket,
                ],
                indent: 1,
              })
            ),
            el(PDFTableRow, {
              key: `pt-${s.title}`,
              cells: [`Total ${s.title}`, '', formatCurrency(s.total), ''],
              isBold: true,
            }),
          ]),
          el(PDFSectionDivider),
          el(PDFTableRow, {
            cells: [
              'GRAND TOTAL',
              '',
              formatCurrency(data.grandTotal),
              '',
            ],
            isBold: true,
          })
        )
      )
    }

    // -----------------------------------------------------------------------
    // Report #8: Rent Collection Status
    // -----------------------------------------------------------------------
    case 'rent-collection': {
      const { getRentCollectionData } = await import(
        '@/lib/reports/rent-collection'
      )
      const month = params.get('month') ?? undefined
      const data = await getRentCollectionData(month ? { month } : undefined)
      return renderToBuffer(
        el(
          ReportDocument,
          {
            title: 'Rent Collection Status',
            dateRange: `Month: ${data.month}`,
          },
          el(PDFTableHeader, {
            columns: [
              { label: 'Tenant / Unit' },
              { label: 'Billed' },
              { label: 'Collected' },
              { label: 'Outstanding' },
              { label: 'Rate' },
            ],
          }),
          ...data.rows.map((r) =>
            el(PDFTableRow, {
              key: `rc-${r.tenantId}`,
              cells: [
                `${r.tenantName} (${r.unitNumber})`,
                formatCurrency(r.billed),
                formatCurrency(r.collected),
                formatCurrency(r.outstanding),
                `${r.collectionRate.toFixed(0)}%`,
              ],
            })
          ),
          el(PDFSectionDivider),
          el(PDFTableRow, {
            cells: [
              'TOTALS',
              formatCurrency(data.totalBilled),
              formatCurrency(data.totalCollected),
              formatCurrency(data.totalOutstanding),
              `${data.collectionRate.toFixed(0)}%`,
            ],
            isBold: true,
          }),
          el(PDFTableRow, {
            cells: [
              `Occupancy: ${data.occupiedUnits}/${data.totalUnits} (${(data.occupancyRate * 100).toFixed(0)}%)`,
              '',
              '',
              '',
              '',
            ],
          }),
          el(PDFTableRow, {
            cells: [
              'Vacancy Loss',
              '',
              '',
              formatCurrency(data.vacancyLoss),
              '',
            ],
          })
        )
      )
    }

    // -----------------------------------------------------------------------
    // Report #9: Fund Draw-Down
    // -----------------------------------------------------------------------
    case 'fund-drawdown': {
      const { getFundDrawdownData } = await import(
        '@/lib/reports/fund-drawdown'
      )
      const data = await getFundDrawdownData()
      return renderToBuffer(
        el(
          ReportDocument,
          {
            title: 'Fund Draw-Down / Restricted Grant Status',
            dateRange: `As of ${endDate}`,
          },
          el(PDFTableHeader, {
            columns: [
              { label: 'Fund' },
              { label: 'Awarded' },
              { label: 'Spent' },
              { label: 'Remaining' },
              { label: 'Draw-Down %' },
            ],
          }),
          ...data.rows.map((r) =>
            el(PDFTableRow, {
              key: `fd-${r.fundId}`,
              cells: [
                r.fundName,
                formatCurrency(r.totalAwarded),
                formatCurrency(r.totalSpent),
                formatCurrency(r.remaining),
                `${r.drawdownPercent.toFixed(0)}%`,
              ],
            })
          ),
          el(PDFSectionDivider),
          el(PDFTableRow, {
            cells: [
              'TOTALS',
              formatCurrency(data.totalAwarded),
              formatCurrency(data.totalSpent),
              formatCurrency(data.totalRemaining),
              '',
            ],
            isBold: true,
          })
        )
      )
    }

    // -----------------------------------------------------------------------
    // Report #10: Grant Compliance Tracking
    // -----------------------------------------------------------------------
    case 'grant-compliance': {
      const { getGrantComplianceData } = await import(
        '@/lib/reports/grant-compliance'
      )
      const data = await getGrantComplianceData()
      return renderToBuffer(
        el(
          ReportDocument,
          {
            title: 'Grant Compliance Tracking',
            dateRange: `As of ${endDate}`,
          },
          el(PDFTableHeader, {
            columns: [
              { label: 'Grant / Funder' },
              { label: 'Award' },
              { label: 'Spent' },
              { label: 'Remaining' },
              { label: 'Status' },
            ],
          }),
          ...data.rows.map((r) =>
            el(PDFTableRow, {
              key: `gc-${r.grantId}`,
              cells: [
                `${r.funderName}${r.isAtRisk ? ' [AT RISK]' : ''}`,
                formatCurrency(r.awardAmount),
                formatCurrency(r.amountSpent),
                formatCurrency(r.amountRemaining),
                `${r.spentPercent.toFixed(0)}% spent${r.daysRemaining !== null ? ` / ${r.daysRemaining}d left` : ''}`,
              ],
            })
          ),
          el(PDFSectionDivider),
          el(PDFTableRow, {
            cells: [
              `${data.activeGrants} active grants (${data.atRiskGrants} at risk)`,
              formatCurrency(data.totalAwards),
              formatCurrency(data.totalSpent),
              '',
              '',
            ],
            isBold: true,
          })
        )
      )
    }

    // -----------------------------------------------------------------------
    // Report #11: Fund-Level P&L and Balance Sheet
    // -----------------------------------------------------------------------
    case 'fund-level': {
      const { getFundLevelData } = await import('@/lib/reports/fund-level')
      if (!fundId) {
        return renderToBuffer(
          el(
            ReportDocument,
            { title: 'Fund-Level Report' },
            el(PDFTableRow, {
              cells: ['Please select a fund to generate this report.', ''],
            })
          )
        )
      }
      const data = await getFundLevelData(fundId, endDate)
      // Render balance sheet section
      const bs = data.balanceSheet
      return renderToBuffer(
        el(
          ReportDocument,
          {
            title: `Fund-Level Report: ${data.fundName}`,
            dateRange: `As of ${endDate}`,
            fundName: data.fundName,
          },
          el(PDFTableHeader, {
            columns: [{ label: 'Account' }, { label: 'Balance' }],
          }),
          el(PDFTableRow, {
            cells: ['— BALANCE SHEET —', ''],
            isSectionHeader: true,
          }),
          el(PDFTableRow, {
            cells: ['Total Assets', formatCurrency(bs.totalAssets)],
            isBold: true,
          }),
          el(PDFTableRow, {
            cells: [
              'Total Liabilities',
              formatCurrency(bs.totalLiabilities),
            ],
            isBold: true,
          }),
          el(PDFTableRow, {
            cells: [
              'Total Net Assets',
              formatCurrency(bs.totalNetAssets),
            ],
            isBold: true,
          }),
          el(PDFSectionDivider),
          el(PDFTableRow, {
            cells: ['— STATEMENT OF ACTIVITIES —', ''],
            isSectionHeader: true,
          }),
          el(PDFTableHeader, {
            columns: [
              { label: 'Category' },
              { label: 'Current Period' },
              { label: 'YTD' },
            ],
          }),
          el(PDFTableRow, {
            cells: [
              'Total Revenue',
              formatCurrency(data.activities.totalRevenue.currentPeriod),
              formatCurrency(data.activities.totalRevenue.yearToDate),
            ],
            isBold: true,
          }),
          el(PDFTableRow, {
            cells: [
              'Total Expenses',
              formatCurrency(data.activities.totalExpenses.currentPeriod),
              formatCurrency(data.activities.totalExpenses.yearToDate),
            ],
            isBold: true,
          }),
          el(PDFTableRow, {
            cells: [
              'Change in Net Assets',
              formatCurrency(data.activities.changeInNetAssets.currentPeriod),
              formatCurrency(data.activities.changeInNetAssets.yearToDate),
            ],
            isBold: true,
          })
        )
      )
    }

    // -----------------------------------------------------------------------
    // Report #12: Property Operating Expense Breakdown
    // -----------------------------------------------------------------------
    case 'property-expenses': {
      const { getPropertyExpensesData } = await import(
        '@/lib/reports/property-expenses'
      )
      const data = await getPropertyExpensesData({ startDate, endDate, fundId })
      return renderToBuffer(
        el(
          ReportDocument,
          {
            title: 'Property Operating Expense Breakdown',
            dateRange: `${startDate} to ${endDate}`,
            fundName: data.fundName,
          },
          el(PDFTableHeader, {
            columns: [
              { label: 'Category' },
              { label: 'Actual' },
              { label: 'Budget' },
              { label: 'Variance' },
            ],
          }),
          ...data.rows.map((r, i) =>
            el(PDFTableRow, {
              key: `pe-${i}`,
              cells: [
                r.category,
                formatCurrency(r.actual),
                r.budget !== null ? formatCurrency(r.budget) : '—',
                r.variance
                  ? `${formatCurrency(r.variance.dollarVariance)} (${formatPercent(r.variance.percentVariance)})`
                  : '—',
              ],
            })
          ),
          el(PDFSectionDivider),
          el(PDFTableRow, {
            cells: [
              'TOTAL',
              formatCurrency(data.total.actual),
              data.total.budget !== null
                ? formatCurrency(data.total.budget)
                : '—',
              '',
            ],
            isBold: true,
          })
        )
      )
    }

    // -----------------------------------------------------------------------
    // Report #13: Utility Trend Analysis
    // -----------------------------------------------------------------------
    case 'utility-trends': {
      const { getUtilityTrendsData } = await import(
        '@/lib/reports/utility-trends'
      )
      const data = await getUtilityTrendsData()
      const utilityCols = [
        { label: 'Month' },
        ...data.utilityTypes.map((t) => ({ label: t })),
        { label: 'Total' },
      ]
      return renderToBuffer(
        el(
          ReportDocument,
          {
            title: 'Utility Trend Analysis',
            dateRange: '12-Month Rolling Window',
          },
          el(PDFTableHeader, { columns: utilityCols }),
          ...data.months.map((m, i) =>
            el(PDFTableRow, {
              key: `ut-${i}`,
              cells: [
                m.month,
                ...data.utilityTypes.map((t) =>
                  formatCurrency(m.values[t] ?? 0)
                ),
                formatCurrency(m.total),
              ],
            })
          ),
          ...(data.yearOverYear
            ? [
                el(PDFSectionDivider, { key: 'yoy-div' }),
                el(PDFTableRow, {
                  key: 'yoy',
                  cells: [
                    `YoY Change: ${formatCurrency(data.yearOverYear.change)} (${formatPercent(data.yearOverYear.changePercent)})`,
                    '',
                    '',
                    '',
                    '',
                    '',
                    '',
                  ],
                  isBold: true,
                }),
              ]
            : [])
        )
      )
    }

    // -----------------------------------------------------------------------
    // Report #14: Security Deposit Register
    // -----------------------------------------------------------------------
    case 'security-deposit-register': {
      const { getSecurityDepositRegister } = await import(
        '@/lib/reports/security-deposit-register'
      )
      const data = await getSecurityDepositRegister()
      return renderToBuffer(
        el(
          ReportDocument,
          {
            title: 'Security Deposit Register',
            dateRange: `As of ${endDate}`,
          },
          el(PDFTableHeader, {
            columns: [
              { label: 'Tenant / Unit' },
              { label: 'Deposit' },
              { label: 'Interest Accrued' },
              { label: 'Interest Paid YTD' },
              { label: 'Status' },
            ],
          }),
          ...data.rows.map((r) =>
            el(PDFTableRow, {
              key: `sd-${r.tenantId}`,
              cells: [
                `${r.tenantName} (${r.unitNumber})`,
                formatCurrency(r.depositAmount),
                formatCurrency(r.interestAccrued),
                formatCurrency(r.interestPaidYtd),
                r.isActive ? 'Active' : 'Inactive',
              ],
            })
          ),
          el(PDFSectionDivider),
          el(PDFTableRow, {
            cells: [
              'Total Deposits Held',
              formatCurrency(data.totalDepositsHeld),
              '',
              '',
              '',
            ],
            isBold: true,
          }),
          el(PDFTableRow, {
            cells: [
              'GL Liability Balance',
              formatCurrency(data.glLiabilityBalance),
              '',
              '',
              data.hasVariance ? 'VARIANCE' : 'Reconciled',
            ],
          }),
          el(PDFTableRow, {
            cells: [
              'GL Escrow Balance',
              formatCurrency(data.glEscrowBalance),
              '',
              '',
              '',
            ],
          })
        )
      )
    }

    // -----------------------------------------------------------------------
    // Report #14: Donor Giving History
    // -----------------------------------------------------------------------
    case 'donor-giving-history': {
      const { getDonorGivingHistoryData } = await import(
        '@/lib/reports/donor-giving-history'
      )
      const data = await getDonorGivingHistoryData({ startDate, endDate, fundId })
      return renderToBuffer(
        el(
          ReportDocument,
          { title: 'Donor Giving History', dateRange: `${startDate} to ${endDate}` },
          el(PDFTableHeader, {
            columns: [
              { label: 'Donor' },
              { label: 'Total Given' },
              { label: 'Restricted' },
              { label: 'Unrestricted' },
              { label: 'Gifts' },
            ],
          }),
          ...data.rows.map((r) =>
            el(PDFTableRow, {
              key: `dg-${r.donorId}`,
              cells: [
                r.donorName,
                formatCurrency(r.totalGiven),
                formatCurrency(r.restrictedAmount),
                formatCurrency(r.unrestrictedAmount),
                String(r.giftCount),
              ],
            })
          ),
          el(PDFSectionDivider),
          el(PDFTableRow, {
            cells: [
              `${data.totalDonors} donors`,
              formatCurrency(data.totalGiving),
              formatCurrency(data.totalRestricted),
              formatCurrency(data.totalUnrestricted),
              '',
            ],
            isBold: true,
          })
        )
      )
    }

    // -----------------------------------------------------------------------
    // Report #15: Cash Projection
    // -----------------------------------------------------------------------
    case 'cash-projection': {
      const { getCashProjectionData } = await import(
        '@/lib/reports/cash-projection'
      )
      const data = await getCashProjectionData()
      return renderToBuffer(
        el(
          ReportDocument,
          {
            title: 'Cash Projection',
            dateRange: `FY${data.fiscalYear}`,
          },
          el(PDFTableHeader, {
            columns: [
              { label: 'Month' },
              { label: 'Inflows' },
              { label: 'Outflows' },
              { label: 'Net' },
              { label: 'Ending Cash' },
            ],
          }),
          ...data.months.map((m, i) =>
            el(PDFTableRow, {
              key: `cp-${i}`,
              cells: [
                m.monthLabel,
                formatCurrency(m.totalInflows),
                formatCurrency(m.totalOutflows),
                formatCurrency(m.netCashFlow),
                formatCurrency(data.endingCashByMonth[i] ?? 0),
              ],
            })
          ),
          el(PDFSectionDivider),
          el(PDFTableRow, {
            cells: [
              `Starting Cash: ${formatCurrency(data.startingCash)}`,
              '',
              '',
              '',
              '',
            ],
          })
        )
      )
    }

    // -----------------------------------------------------------------------
    // Report #16: AHP Loan Summary
    // -----------------------------------------------------------------------
    case 'ahp-loan-summary': {
      const { getAHPLoanSummaryData } = await import(
        '@/lib/reports/ahp-loan-summary'
      )
      const data = await getAHPLoanSummaryData()
      return renderToBuffer(
        el(
          ReportDocument,
          { title: 'AHP Loan Summary', dateRange: `As of ${endDate}` },
          ...(data.summary
            ? [
                el(PDFTableHeader, {
                  key: 'ahp-hdr',
                  columns: [{ label: 'Item' }, { label: 'Value' }],
                }),
                el(PDFTableRow, {
                  key: 'ahp-cl',
                  cells: ['Credit Limit', formatCurrency(data.summary.creditLimit)],
                }),
                el(PDFTableRow, {
                  key: 'ahp-dr',
                  cells: ['Current Drawn', formatCurrency(data.summary.currentDrawnAmount)],
                }),
                el(PDFTableRow, {
                  key: 'ahp-av',
                  cells: ['Available Credit', formatCurrency(data.summary.availableCredit)],
                  isBold: true,
                }),
                el(PDFTableRow, {
                  key: 'ahp-ir',
                  cells: ['Interest Rate', `${data.summary.currentInterestRate}%`],
                }),
                el(PDFTableRow, {
                  key: 'ahp-ia',
                  cells: ['Total Interest Accrued', formatCurrency(data.totalInterestAccrued)],
                }),
                el(PDFSectionDivider, { key: 'ahp-div1' }),
                el(PDFTableRow, {
                  key: 'ahp-hist-h',
                  cells: ['Draw/Payment History', ''],
                  isSectionHeader: true,
                }),
                ...data.drawPaymentHistory.map((e, i) =>
                  el(PDFTableRow, {
                    key: `ahp-dp-${i}`,
                    cells: [
                      `${e.date} — ${e.type === 'draw' ? 'Draw' : 'Payment'}: ${e.memo}`,
                      formatCurrency(e.amount),
                    ],
                  })
                ),
              ]
            : [
                el(PDFTableRow, {
                  cells: ['No AHP loan configuration found.', ''],
                }),
              ])
        )
      )
    }

    // -----------------------------------------------------------------------
    // Report #17: Audit Log
    // -----------------------------------------------------------------------
    case 'audit-log': {
      const { getAuditLogData } = await import('@/lib/reports/audit-log')
      const data = await getAuditLogData({ startDate, endDate, pageSize: 200 })
      return renderToBuffer(
        el(
          ReportDocument,
          { title: 'Audit Log', dateRange: `${startDate} to ${endDate}` },
          el(PDFTableHeader, {
            columns: [
              { label: 'Timestamp' },
              { label: 'User' },
              { label: 'Action' },
              { label: 'Entity' },
            ],
          }),
          ...data.entries.map((e) =>
            el(PDFTableRow, {
              key: `al-${e.id}`,
              cells: [
                e.timestamp.substring(0, 19).replace('T', ' '),
                e.userId,
                e.action,
                `${e.entityType} #${e.entityId}`,
              ],
            })
          ),
          el(PDFSectionDivider),
          el(PDFTableRow, {
            cells: [`${data.totalCount} total entries`, '', '', ''],
            isBold: true,
          })
        )
      )
    }

    // -----------------------------------------------------------------------
    // Report #18: Transaction History
    // -----------------------------------------------------------------------
    case 'transaction-history': {
      const { getTransactionHistoryData } = await import(
        '@/lib/reports/transaction-history'
      )
      const data = await getTransactionHistoryData({
        startDate,
        endDate,
        fundId,
        pageSize: 200,
      })
      return renderToBuffer(
        el(
          ReportDocument,
          {
            title: 'Transaction History',
            dateRange: `${startDate} to ${endDate}`,
          },
          el(PDFTableHeader, {
            columns: [
              { label: 'Date' },
              { label: 'Memo' },
              { label: 'Source' },
              { label: 'Debit' },
              { label: 'Credit' },
            ],
          }),
          ...data.rows.map((r) =>
            el(PDFTableRow, {
              key: `th-${r.id}`,
              cells: [
                r.date,
                r.memo.substring(0, 50),
                r.sourceType,
                formatCurrency(r.totalDebit),
                formatCurrency(r.totalCredit),
              ],
            })
          ),
          el(PDFSectionDivider),
          el(PDFTableRow, {
            cells: [`${data.totalCount} transactions total`, '', '', '', ''],
            isBold: true,
          })
        )
      )
    }

    // -----------------------------------------------------------------------
    // Report #19: Late Entries
    // -----------------------------------------------------------------------
    case 'late-entries': {
      const { getLateEntriesData } = await import('@/lib/reports/late-entries')
      const data = await getLateEntriesData({ periodEndDate: endDate })
      return renderToBuffer(
        el(
          ReportDocument,
          {
            title: 'Late Entries Report',
            dateRange: `Period ending ${data.periodEndDate}`,
          },
          el(PDFTableHeader, {
            columns: [
              { label: 'Date' },
              { label: 'Memo' },
              { label: 'Source' },
              { label: 'Amount' },
              { label: 'Days Late' },
            ],
          }),
          ...data.rows.map((r) =>
            el(PDFTableRow, {
              key: `le-${r.transactionId}`,
              cells: [
                r.date,
                r.memo.substring(0, 50),
                r.sourceType,
                formatCurrency(r.totalAmount),
                String(r.daysLate),
              ],
            })
          ),
          el(PDFSectionDivider),
          el(PDFTableRow, {
            cells: [
              `${data.totalLateEntries} late entries`,
              '',
              '',
              formatCurrency(data.totalLateAmount),
              '',
            ],
            isBold: true,
          })
        )
      )
    }

    // -----------------------------------------------------------------------
    // Report #20: AHP Annual Package
    // -----------------------------------------------------------------------
    case 'ahp-annual-package': {
      const { getAHPAnnualPackageData } = await import(
        '@/lib/reports/ahp-annual-package'
      )
      const year = params.get('year')
        ? parseInt(params.get('year')!)
        : new Date().getFullYear()
      const data = await getAHPAnnualPackageData({ fiscalYear: year })
      return renderToBuffer(
        el(
          ReportDocument,
          {
            title: 'AHP Annual Compliance Package',
            dateRange: `FY${data.fiscalYear}`,
          },
          el(PDFTableRow, {
            cells: ['Balance Sheet Summary', ''],
            isSectionHeader: true,
          }),
          el(PDFTableRow, {
            cells: ['Total Assets', formatCurrency(data.balanceSheet.totalAssets)],
            isBold: true,
          }),
          el(PDFTableRow, {
            cells: ['Total Liabilities', formatCurrency(data.balanceSheet.totalLiabilities)],
          }),
          el(PDFTableRow, {
            cells: ['Total Net Assets', formatCurrency(data.balanceSheet.totalNetAssets)],
            isBold: true,
          }),
          el(PDFSectionDivider),
          el(PDFTableRow, {
            cells: ['Loan Summary', ''],
            isSectionHeader: true,
          }),
          ...(data.loanSummary.summary
            ? [
                el(PDFTableRow, {
                  key: 'ahp-pkg-cl',
                  cells: ['Credit Limit', formatCurrency(data.loanSummary.summary.creditLimit)],
                }),
                el(PDFTableRow, {
                  key: 'ahp-pkg-dr',
                  cells: ['Drawn', formatCurrency(data.loanSummary.summary.currentDrawnAmount)],
                }),
                el(PDFTableRow, {
                  key: 'ahp-pkg-ia',
                  cells: ['Interest Accrued', formatCurrency(data.loanSummary.totalInterestAccrued)],
                }),
              ]
            : [el(PDFTableRow, { cells: ['No AHP loan data', ''] })])
        )
      )
    }

    // -----------------------------------------------------------------------
    // Report #21: Form 990 Data
    // -----------------------------------------------------------------------
    case 'form-990-data': {
      const { getForm990Data } = await import('@/lib/reports/form-990-data')
      const year = params.get('year')
        ? parseInt(params.get('year')!)
        : new Date().getFullYear()
      const data = await getForm990Data({ fiscalYear: year })
      return renderToBuffer(
        el(
          ReportDocument,
          { title: 'Form 990 Data Worksheet', dateRange: `FY${data.fiscalYear}` },
          el(PDFTableRow, {
            cells: ['Part IX — Functional Expenses', '', '', '', ''],
            isSectionHeader: true,
          }),
          el(PDFTableHeader, {
            columns: [
              { label: 'Line' },
              { label: 'Total' },
              { label: 'Program' },
              { label: 'M&G' },
              { label: 'Fundraising' },
            ],
          }),
          ...data.partIXExpenses.map((r) =>
            el(PDFTableRow, {
              key: `990e-${r.form990Line}`,
              cells: [
                `${r.form990Line} — ${r.lineLabel}`,
                formatCurrency(r.total),
                formatCurrency(r.program),
                formatCurrency(r.admin),
                formatCurrency(r.fundraising),
              ],
            })
          ),
          el(PDFTableRow, {
            cells: [
              'Total',
              formatCurrency(data.partIXTotal.total),
              formatCurrency(data.partIXTotal.program),
              formatCurrency(data.partIXTotal.admin),
              formatCurrency(data.partIXTotal.fundraising),
            ],
            isBold: true,
          }),
          el(PDFSectionDivider),
          el(PDFTableRow, {
            cells: ['Revenue', '', '', '', ''],
            isSectionHeader: true,
          }),
          ...data.revenue.map((r) =>
            el(PDFTableRow, {
              key: `990r-${r.form990Line}`,
              cells: [
                `${r.form990Line} — ${r.lineLabel}`,
                formatCurrency(r.amount),
                '',
                '',
                '',
              ],
            })
          ),
          el(PDFTableRow, {
            cells: ['Total Revenue', formatCurrency(data.totalRevenue), '', '', ''],
            isBold: true,
          })
        )
      )
    }

    // -----------------------------------------------------------------------
    // Report #23: Compliance Calendar
    // -----------------------------------------------------------------------
    case 'compliance-calendar': {
      const { getComplianceCalendarData } = await import(
        '@/lib/reports/compliance-calendar'
      )
      const data = await getComplianceCalendarData({})
      return renderToBuffer(
        el(
          ReportDocument,
          { title: 'Compliance Calendar', dateRange: `As of ${endDate}` },
          ...(data.overdue.length > 0
            ? [
                el(PDFTableRow, {
                  key: 'cc-oh',
                  cells: ['OVERDUE', '', '', ''],
                  isSectionHeader: true,
                }),
                el(PDFTableHeader, {
                  key: 'cc-ohdr',
                  columns: [
                    { label: 'Task' },
                    { label: 'Due Date' },
                    { label: 'Category' },
                    { label: 'Days Overdue' },
                  ],
                }),
                ...data.overdue.map((d) =>
                  el(PDFTableRow, {
                    key: `cc-o-${d.id}`,
                    cells: [d.taskName, d.dueDate, d.category, String(Math.abs(d.daysUntilDue))],
                  })
                ),
              ]
            : []),
          el(PDFTableRow, {
            key: 'cc-uh',
            cells: ['UPCOMING', '', '', ''],
            isSectionHeader: true,
          }),
          ...data.upcoming.map((d) =>
            el(PDFTableRow, {
              key: `cc-u-${d.id}`,
              cells: [d.taskName, d.dueDate, d.category, `${d.daysUntilDue}d`],
            })
          ),
          el(PDFTableRow, {
            key: 'cc-fh',
            cells: ['THIS QUARTER', '', '', ''],
            isSectionHeader: true,
          }),
          ...data.thisQuarter.map((d) =>
            el(PDFTableRow, {
              key: `cc-q-${d.id}`,
              cells: [d.taskName, d.dueDate, d.category, `${d.daysUntilDue}d`],
            })
          ),
          el(PDFSectionDivider),
          el(PDFTableRow, {
            cells: [`${data.totalCount} total deadlines (${data.overdueCount} overdue)`, '', '', ''],
            isBold: true,
          })
        )
      )
    }

    // -----------------------------------------------------------------------
    // Report #24: Capital Budget
    // -----------------------------------------------------------------------
    case 'capital-budget': {
      const { getCapitalBudgetData } = await import(
        '@/lib/reports/capital-budget'
      )
      const year = params.get('year')
        ? parseInt(params.get('year')!)
        : new Date().getFullYear()
      const data = await getCapitalBudgetData({ year, fundId })
      return renderToBuffer(
        el(
          ReportDocument,
          {
            title: 'Capital Budget vs Actual',
            dateRange: `FY${data.year}`,
            fundName: data.fundName,
          },
          el(PDFTableHeader, {
            columns: [
              { label: 'Account' },
              { label: 'Budget' },
              { label: 'Actual' },
              { label: 'Variance' },
              { label: 'Var %' },
            ],
          }),
          ...data.rows.map((r) =>
            el(PDFTableRow, {
              key: `cb-${r.accountId}`,
              cells: [
                `${r.accountCode} — ${r.accountName}`,
                formatCurrency(r.budget),
                formatCurrency(r.actual),
                formatCurrency(r.variance),
                r.variancePercent !== null ? formatPercent(r.variancePercent) : '—',
              ],
            })
          ),
          el(PDFSectionDivider),
          el(PDFTableRow, {
            cells: [
              'TOTAL',
              formatCurrency(data.totalBudget),
              formatCurrency(data.totalActual),
              formatCurrency(data.totalVariance),
              '',
            ],
            isBold: true,
          })
        )
      )
    }

    // -----------------------------------------------------------------------
    // Report #25: Payroll Register
    // -----------------------------------------------------------------------
    case 'payroll-register': {
      const { getPayrollRegisterData } = await import(
        '@/lib/reports/payroll-register'
      )
      const data = await getPayrollRegisterData({ startDate, endDate })
      return renderToBuffer(
        el(
          ReportDocument,
          { title: 'Payroll Register', dateRange: `${startDate} to ${endDate}` },
          ...data.runs.flatMap((run) => [
            el(PDFTableRow, {
              key: `pr-h-${run.runId}`,
              cells: [`Pay Period: ${run.payPeriodStart} to ${run.payPeriodEnd}`, '', '', '', ''],
              isSectionHeader: true,
            }),
            el(PDFTableHeader, {
              key: `pr-hdr-${run.runId}`,
              columns: [
                { label: 'Employee' },
                { label: 'Gross' },
                { label: 'Fed Tax' },
                { label: 'State Tax' },
                { label: 'Net' },
              ],
            }),
            ...run.rows.map((r) =>
              el(PDFTableRow, {
                key: `pr-${run.runId}-${r.entryId}`,
                cells: [
                  r.employeeName,
                  formatCurrency(r.grossPay),
                  formatCurrency(r.federalWithholding),
                  formatCurrency(r.stateWithholding),
                  formatCurrency(r.netPay),
                ],
              })
            ),
            el(PDFTableRow, {
              key: `pr-t-${run.runId}`,
              cells: [
                'Run Total',
                formatCurrency(run.totalGross),
                formatCurrency(run.totalFederal),
                formatCurrency(run.totalState),
                formatCurrency(run.totalNet),
              ],
              isBold: true,
            }),
          ]),
          el(PDFSectionDivider),
          el(PDFTableRow, {
            cells: [
              'GRAND TOTAL',
              formatCurrency(data.grandTotalGross),
              formatCurrency(data.grandTotalFederal),
              formatCurrency(data.grandTotalState),
              formatCurrency(data.grandTotalNet),
            ],
            isBold: true,
          })
        )
      )
    }

    // -----------------------------------------------------------------------
    // Report #26: Payroll Tax Liability
    // -----------------------------------------------------------------------
    case 'payroll-tax-liability': {
      const { getPayrollTaxLiabilityData } = await import(
        '@/lib/reports/payroll-tax-liability'
      )
      const data = await getPayrollTaxLiabilityData({ startDate, endDate })
      return renderToBuffer(
        el(
          ReportDocument,
          {
            title: 'Payroll Tax Liability Summary',
            dateRange: `${data.periodStart} to ${data.periodEnd}`,
          },
          el(PDFTableHeader, {
            columns: [
              { label: 'Tax Type' },
              { label: 'Employee' },
              { label: 'Employer' },
              { label: 'Total' },
            ],
          }),
          ...data.rows.map((r, i) =>
            el(PDFTableRow, {
              key: `ptl-${i}`,
              cells: [
                r.taxType,
                formatCurrency(r.employeeAmount),
                formatCurrency(r.employerAmount),
                formatCurrency(r.totalAmount),
              ],
            })
          ),
          el(PDFSectionDivider),
          el(PDFTableRow, {
            cells: [
              'TOTAL',
              formatCurrency(data.totalEmployeeWithholding),
              formatCurrency(data.totalEmployerContribution),
              formatCurrency(data.grandTotal),
            ],
            isBold: true,
          }),
          el(PDFTableRow, {
            cells: [`${data.employeeCount} employees`, '', '', ''],
          })
        )
      )
    }

    // -----------------------------------------------------------------------
    // Report #27: W-2 Verification
    // -----------------------------------------------------------------------
    case 'w2-verification': {
      const { getW2VerificationData } = await import(
        '@/lib/reports/w2-verification'
      )
      const year = params.get('year')
        ? parseInt(params.get('year')!)
        : new Date().getFullYear()
      const data = await getW2VerificationData({ year })
      return renderToBuffer(
        el(
          ReportDocument,
          { title: 'W-2 Verification Report', dateRange: `Tax Year ${data.year}` },
          el(PDFTableHeader, {
            columns: [
              { label: 'Employee' },
              { label: 'Box 1' },
              { label: 'Box 2' },
              { label: 'Box 3' },
              { label: 'Box 5' },
              { label: 'Box 16' },
            ],
          }),
          ...data.rows.map((r) =>
            el(PDFTableRow, {
              key: `w2-${r.employeeId}`,
              cells: [
                `${r.employeeName}${r.hasWageBaseExceeded ? ' *' : ''}`,
                formatCurrency(r.box1),
                formatCurrency(r.box2),
                formatCurrency(r.box3),
                formatCurrency(r.box5),
                formatCurrency(r.box16),
              ],
            })
          ),
          el(PDFSectionDivider),
          el(PDFTableRow, {
            cells: [
              `${data.totalEmployees} employees | SS Wage Base: ${formatCurrency(data.ssWageBase)}`,
              '',
              '',
              '',
              '',
              '',
            ],
            isBold: true,
          })
        )
      )
    }

    // -----------------------------------------------------------------------
    // Report #28: Employer Payroll Cost
    // -----------------------------------------------------------------------
    case 'employer-payroll-cost': {
      const { getEmployerPayrollCostData } = await import(
        '@/lib/reports/employer-payroll-cost'
      )
      const year = params.get('year')
        ? parseInt(params.get('year')!)
        : new Date().getFullYear()
      const data = await getEmployerPayrollCostData({ year })
      return renderToBuffer(
        el(
          ReportDocument,
          { title: 'Employer Payroll Cost Analysis', dateRange: `FY${data.year}` },
          el(PDFTableHeader, {
            columns: [
              { label: 'Month' },
              { label: 'Wages' },
              { label: 'Employer FICA' },
              { label: 'Total Burden' },
              { label: 'Budget' },
            ],
          }),
          ...data.months.map((m) =>
            el(PDFTableRow, {
              key: `epc-${m.month}`,
              cells: [
                m.monthLabel,
                formatCurrency(m.totalWages),
                formatCurrency(m.totalEmployerFICA),
                formatCurrency(m.totalBurden),
                m.budget !== null ? formatCurrency(m.budget) : '—',
              ],
            })
          ),
          el(PDFSectionDivider),
          el(PDFTableRow, {
            cells: [
              'YTD Total',
              formatCurrency(data.ytdWages),
              formatCurrency(data.ytdTotalFICA),
              formatCurrency(data.ytdTotalBurden),
              data.ytdBudget !== null ? formatCurrency(data.ytdBudget) : '—',
            ],
            isBold: true,
          })
        )
      )
    }

    // -----------------------------------------------------------------------
    // Report #29: Quarterly Tax Prep
    // -----------------------------------------------------------------------
    case 'quarterly-tax-prep': {
      const { getQuarterlyTaxPrepData } = await import(
        '@/lib/reports/quarterly-tax-prep'
      )
      const year = params.get('year')
        ? parseInt(params.get('year')!)
        : new Date().getFullYear()
      const quarter = params.get('quarter')
        ? parseInt(params.get('quarter')!)
        : Math.ceil((new Date().getMonth() + 1) / 3)
      const data = await getQuarterlyTaxPrepData({ year, quarter })
      const f = data.federal941
      const m = data.maM941
      return renderToBuffer(
        el(
          ReportDocument,
          {
            title: `Quarterly Tax Prep — ${data.quarterLabel}`,
            dateRange: `${data.periodStart} to ${data.periodEnd}`,
          },
          el(PDFTableRow, {
            cells: ['Federal Form 941', ''],
            isSectionHeader: true,
          }),
          el(PDFTableHeader, {
            columns: [{ label: 'Line' }, { label: 'Amount' }],
          }),
          el(PDFTableRow, { cells: ['Line 1 — Number of employees', String(f.line1_employeeCount)] }),
          el(PDFTableRow, { cells: ['Line 2 — Total wages', formatCurrency(f.line2_totalWages)] }),
          el(PDFTableRow, { cells: ['Line 3 — Federal tax withheld', formatCurrency(f.line3_federalTaxWithheld)] }),
          el(PDFTableRow, { cells: ['Line 5a — SS wages', formatCurrency(f.line5a_ssWages)] }),
          el(PDFTableRow, { cells: ['Line 5a — SS tax (12.4%)', formatCurrency(f.line5a_ssTax)] }),
          el(PDFTableRow, { cells: ['Line 5c — Medicare wages', formatCurrency(f.line5c_medicareWages)] }),
          el(PDFTableRow, { cells: ['Line 5c — Medicare tax (2.9%)', formatCurrency(f.line5c_medicareTax)] }),
          el(PDFTableRow, { cells: ['Line 6 — Total tax before adj', formatCurrency(f.line6_totalTaxBeforeAdjustments)], isBold: true }),
          el(PDFTableRow, { cells: ['Line 10 — Total tax after adj', formatCurrency(f.line10_totalTaxAfterAdjustments)], isBold: true }),
          el(PDFSectionDivider),
          el(PDFTableRow, {
            cells: ['MA Form M-941', ''],
            isSectionHeader: true,
          }),
          el(PDFTableRow, { cells: ['Wages subject to MA', formatCurrency(m.totalWagesSubjectToMA)] }),
          el(PDFTableRow, { cells: ['MA income tax withheld', formatCurrency(m.maIncomeTaxWithheld)], isBold: true })
        )
      )
    }

    // -----------------------------------------------------------------------
    // Fallback for unknown reports
    // -----------------------------------------------------------------------
    default: {
      return renderToBuffer(
        el(
          ReportDocument,
          {
            title: reportSlug
              .replace(/-/g, ' ')
              .replace(/\b\w/g, (c) => c.toUpperCase()),
            dateRange: `${startDate} to ${endDate}`,
          },
          el(PDFTableRow, {
            cells: ['PDF export for this report is coming soon.', ''],
          })
        )
      )
    }
  }
}
