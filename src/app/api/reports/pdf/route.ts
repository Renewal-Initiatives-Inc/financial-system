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

// Dynamic PDF generation route
// Accepts: ?report=balance-sheet&startDate=...&endDate=...&fundId=...
// Returns: PDF download

export async function GET(request: NextRequest) {
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
