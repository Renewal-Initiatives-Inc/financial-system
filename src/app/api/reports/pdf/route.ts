import { NextRequest, NextResponse } from 'next/server'
import { renderToBuffer } from '@react-pdf/renderer'
import React from 'react'
import {
  ReportDocument,
  PDFTableHeader,
  PDFTableRow,
  PDFSectionDivider,
  BrandedTableHeader,
  BrandedDataRow,
  BrandedSubtotalRow,
  BrandedTotalRow,
  BrandedSectionHeader,
  BrandedSectionDivider,
} from '@/lib/reports/pdf/report-document'
import type { PDFColumnDef } from '@/lib/reports/pdf/report-document'
import { formatCurrency, formatPercent, REPORT_DEFINITIONS } from '@/lib/reports/types'
import { auth } from '@/lib/auth'

// Slug → readable title mapping (built from REPORT_DEFINITIONS)
const SLUG_TO_TITLE: Record<string, string> = Object.fromEntries(
  REPORT_DEFINITIONS.map((r) => [r.slug, r.title])
)

// Dynamic PDF generation route
// Accepts: ?report=balance-sheet&startDate=...&endDate=...&fundId=...
// Returns: PDF download

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const exportedBy = session.user.name ?? session.user.email ?? 'Unknown'
  const params = request.nextUrl.searchParams
  const reportSlug = params.get('report')

  if (!reportSlug) {
    return NextResponse.json(
      { error: 'Missing report parameter' },
      { status: 400 }
    )
  }

  const readableTitle = SLUG_TO_TITLE[reportSlug] ?? reportSlug
  const dateStr = new Date().toISOString().split('T')[0]
  const filename = `${readableTitle} - ${dateStr}.pdf`

  try {
    const pdfBuffer = await generateReportPDF(reportSlug, params, exportedBy)

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
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
  params: URLSearchParams,
  exportedBy: string
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
      const bsCols: PDFColumnDef[] = [
        { label: 'Account', flex: 3, align: 'left' },
        { label: 'Balance', flex: 1, align: 'right', format: 'currency' },
      ]
      let rowIdx = 0
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bsSection = (title: string, section: any, prefix: string) => [
        el(BrandedSectionHeader, { key: `sh-${prefix}`, title }),
        ...section.rows.map((r: { accountId: number; accountCode: string; accountName: string; balance: number }) =>
          el(BrandedDataRow, {
            key: `${prefix}-${r.accountId}`,
            cells: [`${r.accountCode} — ${r.accountName}`, formatCurrency(r.balance)],
            columns: bsCols,
            rowIndex: rowIdx++,
            indent: 1,
          })
        ),
        el(BrandedSubtotalRow, {
          key: `st-${prefix}`,
          cells: [`Total ${title}`, formatCurrency(section.total)],
          columns: bsCols,
        }),
      ]
      return renderToBuffer(
        el(
          ReportDocument,
          {
            exportedBy,
            title: 'Balance Sheet',
            dateRange: `As of ${endDate}`,
            fundName: data.fundName,
          },
          el(BrandedTableHeader, { columns: bsCols }),
          el(BrandedSectionHeader, { title: 'ASSETS' }),
          ...bsSection('Current Assets', data.currentAssets, 'ca'),
          ...bsSection('Noncurrent Assets', data.noncurrentAssets, 'na'),
          el(BrandedTotalRow, {
            key: 'total-assets',
            cells: ['TOTAL ASSETS', formatCurrency(data.totalAssets)],
            columns: bsCols,
          }),
          el(BrandedSectionDivider, { key: 'div-1' }),
          el(BrandedSectionHeader, { title: 'LIABILITIES' }),
          ...bsSection('Current Liabilities', data.currentLiabilities, 'cl'),
          ...bsSection('Long-Term Liabilities', data.longTermLiabilities, 'lt'),
          el(BrandedTotalRow, {
            key: 'total-liab',
            cells: ['TOTAL LIABILITIES', formatCurrency(data.totalLiabilities)],
            columns: bsCols,
          }),
          el(BrandedSectionDivider, { key: 'div-2' }),
          el(BrandedSectionHeader, { title: 'RETAINED EARNINGS' }),
          ...bsSection('Without Donor Restrictions', data.netAssetsUnrestricted, 'nu'),
          ...bsSection('With Donor Restrictions', data.netAssetsRestricted, 'nr'),
          el(BrandedTotalRow, {
            key: 'total-re',
            cells: ['TOTAL RETAINED EARNINGS', formatCurrency(data.totalNetAssets)],
            columns: bsCols,
          }),
          el(BrandedTotalRow, {
            key: 'total-lre',
            cells: ['TOTAL LIABILITIES & RETAINED EARNINGS', formatCurrency(data.totalLiabilitiesAndNetAssets)],
            columns: bsCols,
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
      const actCols: PDFColumnDef[] = [
        { label: 'Account', flex: 3, align: 'left' },
        { label: 'Current Period', flex: 1, align: 'right', format: 'currency' },
        { label: 'YTD', flex: 1, align: 'right', format: 'currency' },
        { label: 'Budget', flex: 1, align: 'right', format: 'currency' },
      ]
      let actIdx = 0
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const actSection = (sections: any[], prefix: string) =>
        sections.flatMap((s: any) => [
          el(BrandedSectionHeader, { key: `${prefix}h-${s.title}`, title: s.title }),
          ...s.rows.map((r: any) =>
            el(BrandedDataRow, {
              key: `${prefix}-${r.accountId}`,
              cells: [
                `${r.accountCode} — ${r.accountName}`,
                formatCurrency(r.currentPeriod),
                formatCurrency(r.yearToDate),
                r.budget !== null ? formatCurrency(r.budget) : '—',
              ],
              columns: actCols,
              rowIndex: actIdx++,
              indent: 1,
            })
          ),
          el(BrandedSubtotalRow, {
            key: `${prefix}t-${s.title}`,
            cells: [
              `Total ${s.title}`,
              formatCurrency(s.total.currentPeriod),
              formatCurrency(s.total.yearToDate),
              s.total.budget !== null ? formatCurrency(s.total.budget) : '—',
            ],
            columns: actCols,
          }),
        ])
      return renderToBuffer(
        el(
          ReportDocument,
          {
            exportedBy,
            title: 'Income Statement',
            dateRange: `${startDate} to ${endDate}`,
            fundName: data.fundName,
          },
          el(BrandedTableHeader, { columns: actCols }),
          el(BrandedSectionHeader, { title: 'REVENUE' }),
          ...actSection(data.revenueSections, 'r'),
          el(BrandedTotalRow, {
            key: 'total-rev',
            cells: [
              'TOTAL REVENUE',
              formatCurrency(data.totalRevenue.currentPeriod),
              formatCurrency(data.totalRevenue.yearToDate),
              data.totalRevenue.budget !== null ? formatCurrency(data.totalRevenue.budget) : '—',
            ],
            columns: actCols,
          }),
          el(BrandedSectionDivider, { key: 'div-act' }),
          el(BrandedSectionHeader, { title: 'EXPENSES' }),
          ...actSection(data.expenseSections, 'e'),
          el(BrandedTotalRow, {
            key: 'total-exp',
            cells: [
              'TOTAL EXPENSES',
              formatCurrency(data.totalExpenses.currentPeriod),
              formatCurrency(data.totalExpenses.yearToDate),
              data.totalExpenses.budget !== null ? formatCurrency(data.totalExpenses.budget) : '—',
            ],
            columns: actCols,
          }),
          el(BrandedSectionDivider, { key: 'div-act2' }),
          el(BrandedDataRow, {
            cells: [
              'Net Asset Releases',
              formatCurrency(data.netAssetReleases.currentPeriod),
              formatCurrency(data.netAssetReleases.yearToDate),
              '—',
            ],
            columns: actCols,
            rowIndex: 0,
          }),
          el(BrandedTotalRow, {
            key: 'change-re',
            cells: [
              'CHANGE IN RETAINED EARNINGS',
              formatCurrency(data.changeInNetAssets.currentPeriod),
              formatCurrency(data.changeInNetAssets.yearToDate),
              data.changeInNetAssets.budget !== null ? formatCurrency(data.changeInNetAssets.budget) : '—',
            ],
            columns: actCols,
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
      const cfCols: PDFColumnDef[] = [
        { label: 'Description', flex: 3, align: 'left' },
        { label: 'Amount', flex: 1, align: 'right', format: 'currency' },
      ]
      let cfIdx = 0
      return renderToBuffer(
        el(
          ReportDocument,
          {
            exportedBy,
            title: 'Statement of Cash Flows',
            dateRange: `${startDate} to ${endDate}`,
            fundName: data.fundName,
          },
          el(BrandedTableHeader, { columns: cfCols }),
          ...[data.operating, data.investing, data.financing].flatMap((s) => [
            el(BrandedSectionHeader, { key: `sh-${s.title}`, title: s.title }),
            ...s.lines.map((l, i) =>
              l.isSubtotal || l.isTotal
                ? el(BrandedSubtotalRow, {
                    key: `${s.title}-${i}`,
                    cells: [l.label, formatCurrency(l.amount)],
                    columns: cfCols,
                  })
                : el(BrandedDataRow, {
                    key: `${s.title}-${i}`,
                    cells: [l.label, formatCurrency(l.amount)],
                    columns: cfCols,
                    rowIndex: cfIdx++,
                    indent: l.indent,
                  })
            ),
            el(BrandedSubtotalRow, {
              key: `st-${s.title}`,
              cells: [`Net Cash from ${s.title}`, formatCurrency(s.subtotal)],
              columns: cfCols,
            }),
            el(BrandedSectionDivider, { key: `sd-${s.title}` }),
          ]),
          el(BrandedTotalRow, {
            key: 'net-change',
            cells: ['NET CHANGE IN CASH', formatCurrency(data.netChangeInCash)],
            columns: cfCols,
          }),
          el(BrandedDataRow, {
            cells: ['Beginning Cash', formatCurrency(data.beginningCash)],
            columns: cfCols,
            rowIndex: 0,
          }),
          el(BrandedTotalRow, {
            key: 'ending-cash',
            cells: ['ENDING CASH', formatCurrency(data.endingCash)],
            columns: cfCols,
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
      const feCols: PDFColumnDef[] = [
        { label: 'Expense', flex: 3, align: 'left' },
        { label: 'Total', flex: 1, align: 'right', format: 'currency' },
        { label: 'Program', flex: 1, align: 'right', format: 'currency' },
        { label: 'M&G', flex: 1, align: 'right', format: 'currency' },
        { label: 'Fundraising', flex: 1, align: 'right', format: 'currency' },
        ...(hasFR ? [{ label: 'Unalloc.', flex: 1, align: 'right' as const, format: 'currency' as const }] : []),
      ]
      let feIdx = 0
      return renderToBuffer(
        el(
          ReportDocument,
          {
            exportedBy,
            title: `Statement of Functional Expenses (${data.format.toUpperCase()})`,
            dateRange: `${startDate} to ${endDate}`,
            fundName: data.fundName,
          },
          el(BrandedTableHeader, { columns: feCols }),
          ...data.rows.map((r, i) => {
            if (r.isGroupHeader) {
              return el(BrandedSectionHeader, { key: `fe-${i}`, title: r.label })
            }
            if (r.isTotal) {
              return el(BrandedSubtotalRow, {
                key: `fe-${i}`,
                cells: [
                  r.label,
                  formatCurrency(r.total),
                  formatCurrency(r.program),
                  formatCurrency(r.admin),
                  formatCurrency(r.fundraising),
                  ...(hasFR ? [formatCurrency(r.unallocated)] : []),
                ],
                columns: feCols,
              })
            }
            return el(BrandedDataRow, {
              key: `fe-${i}`,
              cells: [
                r.label,
                formatCurrency(r.total),
                formatCurrency(r.program),
                formatCurrency(r.admin),
                formatCurrency(r.fundraising),
                ...(hasFR ? [formatCurrency(r.unallocated)] : []),
              ],
              columns: feCols,
              rowIndex: feIdx++,
            })
          }),
          el(BrandedSectionDivider),
          el(BrandedTotalRow, {
            key: 'fe-total',
            cells: [
              'TOTAL',
              formatCurrency(data.totals.total),
              formatCurrency(data.totals.program),
              formatCurrency(data.totals.admin),
              formatCurrency(data.totals.fundraising),
              ...(hasFR ? [formatCurrency(data.totals.unallocated)] : []),
            ],
            columns: feCols,
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
            exportedBy,
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
          })
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
          { exportedBy, title: 'Accounts Receivable Aging', dateRange: `As of ${endDate}` },
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
          // Funding Source AR
          el(PDFTableRow, {
            cells: ['FUNDING SOURCE AR', '', '', '', '', ''],
            isSectionHeader: true,
          }),
          ...data.fundingSourceAR.rows.map((r) =>
            el(PDFTableRow, {
              key: `gar-${r.fundId}`,
              cells: agingCells(r.funderName, r.aging),
              indent: 1,
            })
          ),
          el(PDFTableRow, {
            cells: agingCells('Total Funding Source AR', data.fundingSourceAR.total),
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
            exportedBy,
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
            exportedBy,
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
            exportedBy,
            title: 'Fund Draw-Down / Restricted Funding Status',
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
          ...data.rows.flatMap((r) => [
            el(PDFTableRow, {
              key: `fd-${r.fundId}`,
              cells: [
                r.fundName,
                formatCurrency(r.totalAwarded),
                formatCurrency(r.totalSpent),
                formatCurrency(r.remaining),
                `${r.drawdownPercent.toFixed(0)}%`,
              ],
            }),
            // Inline contract terms
            ...(r.funderName || r.fundingType || r.conditions || r.fundingStatus
              ? [
                  el(PDFTableRow, {
                    key: `fd-ct-${r.fundId}`,
                    cells: [
                      [
                        r.funderName ? `Funder: ${r.funderName}` : null,
                        r.fundingType ? `Type: ${r.fundingType}` : null,
                        r.fundingStatus ? `Status: ${r.fundingStatus}` : null,
                        r.conditions ? `Conditions: ${r.conditions}` : null,
                      ]
                        .filter(Boolean)
                        .join(' | '),
                      '',
                      '',
                      '',
                      '',
                    ],
                    indent: 1,
                  }),
                ]
              : []),
          ]),
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
    // Report #11: Fund-Level P&L and Balance Sheet
    // -----------------------------------------------------------------------
    case 'fund-level': {
      const { getFundLevelData } = await import('@/lib/reports/fund-level')
      if (!fundId) {
        return renderToBuffer(
          el(
            ReportDocument,
            { exportedBy, title: 'Fund-Level Report' },
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
            exportedBy,
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
              'Total Retained Earnings',
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
              'Change in Retained Earnings',
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
            exportedBy,
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
            exportedBy,
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
            exportedBy,
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
          { exportedBy, title: 'Donor Giving History', dateRange: `${startDate} to ${endDate}` },
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
            exportedBy,
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
    // Report #17: Audit Log
    // -----------------------------------------------------------------------
    case 'audit-log': {
      const { getAuditLogData } = await import('@/lib/reports/audit-log')
      const data = await getAuditLogData({ startDate, endDate, pageSize: 200 })
      return renderToBuffer(
        el(
          ReportDocument,
          { exportedBy, title: 'Audit Log', dateRange: `${startDate} to ${endDate}` },
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
            exportedBy,
            title: 'Transaction History',
            dateRange: `${startDate} to ${endDate}`,
          },
          el(PDFTableHeader, {
            columns: [
              { label: 'Date' },
              { label: 'Memo' },
              { label: 'Source' },
              { label: 'Account' },
              { label: 'Debit' },
              { label: 'Credit' },
            ],
          }),
          ...data.rows.flatMap((r) => [
            el(PDFTableRow, {
              key: `th-${r.id}`,
              cells: [
                r.date,
                r.memo.substring(0, 50),
                r.sourceType,
                '',
                '',
                '',
              ],
              isBold: true,
            }),
            ...r.lines.map((line, i) =>
              el(PDFTableRow, {
                key: `th-${r.id}-ln-${i}`,
                cells: [
                  '',
                  '',
                  '',
                  `${line.accountCode} — ${line.accountName}`,
                  line.debit ? formatCurrency(line.debit) : '',
                  line.credit ? formatCurrency(line.credit) : '',
                ],
              })
            ),
          ]),
          el(PDFSectionDivider),
          el(PDFTableRow, {
            cells: [`${data.totalCount} transactions total`, '', '', '', '', ''],
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
            exportedBy,
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
          { exportedBy, title: 'Form 990 Data Worksheet', dateRange: `FY${data.fiscalYear}` },
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
            exportedBy,
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
          { exportedBy, title: 'Payroll Register', dateRange: `${startDate} to ${endDate}` },
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
            exportedBy,
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
          { exportedBy, title: 'W-2 Verification Report', dateRange: `Tax Year ${data.year}` },
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
          { exportedBy, title: 'Employer Payroll Cost Analysis', dateRange: `FY${data.year}` },
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
            exportedBy,
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
            exportedBy,
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
