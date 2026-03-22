import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
} from '@react-pdf/renderer'
import path from 'path'
import { sharedStyles, PDF_COLORS, PDF_FONTS, PDF_SPACING } from './pdf-theme'

// ---------------------------------------------------------------------------
// Logo path — resolved at render time on the server
// ---------------------------------------------------------------------------
const LOGO_PATH = path.join(process.cwd(), 'public', 'images', 'logo.jpeg')

// ---------------------------------------------------------------------------
// ReportDocument — Branded PDF page wrapper
// ---------------------------------------------------------------------------

interface ReportDocumentProps {
  title: string
  dateRange?: string
  fundName?: string | null
  generatedAt?: string
  exportedBy?: string
  children: React.ReactNode
}

export function ReportDocument({
  title,
  dateRange,
  fundName,
  generatedAt,
  exportedBy,
  children,
}: ReportDocumentProps) {
  const timestamp = generatedAt ?? new Date().toISOString()
  const formattedTime = new Date(timestamp).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
  const exportLine = exportedBy
    ? `Exported ${formattedTime} by ${exportedBy}`
    : `Exported ${formattedTime}`

  return (
    <Document>
      <Page size="LETTER" style={sharedStyles.page} wrap>
        {/* ── Fixed Header (every page) ── */}
        <View style={sharedStyles.bannerBar} fixed />
        <View style={sharedStyles.headerContainer} fixed>
          <View style={sharedStyles.headerLeft}>
            <Image style={sharedStyles.headerLogo} src={LOGO_PATH} />
            <View style={sharedStyles.headerOrgBlock}>
              <Text style={sharedStyles.orgName}>Renewal Initiatives Inc.</Text>
              <Text style={sharedStyles.orgSubtitle}>
                Property Management &amp; Nonprofit Services
              </Text>
            </View>
          </View>
          <View style={sharedStyles.headerRight}>
            <Text style={sharedStyles.reportTitle}>{title}</Text>
            {dateRange && (
              <Text style={sharedStyles.reportMeta}>{dateRange}</Text>
            )}
            <Text style={sharedStyles.reportMeta}>
              Fund: {fundName ?? 'Consolidated'}
            </Text>
          </View>
        </View>
        <View style={sharedStyles.headerDivider} fixed />

        {/* ── Report Body ── */}
        {children}

        {/* ── Fixed Footer (every page) ── */}
        <View style={sharedStyles.footer} fixed>
          <View style={sharedStyles.footerDivider} />
          <View style={sharedStyles.footerRow}>
            <Text>Renewal Initiatives Inc.{'  |  '}{exportLine}</Text>
            <Text
              render={({ pageNumber, totalPages }) =>
                `Page ${pageNumber} of ${totalPages}`
              }
            />
          </View>
          <Text style={sharedStyles.footerDisclaimer}>
            This report is generated deterministically from the general ledger.
            Data is not AI-generated.
          </Text>
        </View>
      </Page>
    </Document>
  )
}

// ---------------------------------------------------------------------------
// Legacy table components — kept for backward compatibility during migration.
// New reports should use Branded* components from ./pdf-table.tsx
// ---------------------------------------------------------------------------

const legacyStyles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 9,
    fontFamily: 'Helvetica',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    paddingBottom: 4,
    marginBottom: 4,
  },
  tableRow: {
    flexDirection: 'row',
    paddingVertical: 2,
  },
  tableRowBold: {
    flexDirection: 'row',
    paddingVertical: 2,
    borderTopWidth: 1,
    borderTopColor: '#ccc',
  },
  sectionHeader: {
    flexDirection: 'row',
    paddingVertical: 4,
    backgroundColor: '#f5f5f5',
    marginTop: 6,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    marginVertical: 8,
  },
  cellLabel: {
    flex: 3,
    paddingRight: 8,
  },
  cellAmount: {
    flex: 1,
    textAlign: 'right' as const,
    paddingRight: 8,
  },
  headerText: {
    fontFamily: 'Helvetica-Bold',
  },
  boldText: {
    fontFamily: 'Helvetica-Bold',
  },
})

interface PDFTableHeaderProps {
  columns: { label: string; flex?: number }[]
}

export function PDFTableHeader({ columns }: PDFTableHeaderProps) {
  return (
    <View style={legacyStyles.tableHeaderRow}>
      {columns.map((col, i) => (
        <Text
          key={i}
          style={[
            i === 0 ? legacyStyles.cellLabel : legacyStyles.cellAmount,
            legacyStyles.headerText,
            col.flex ? { flex: col.flex } : {},
          ]}
        >
          {col.label}
        </Text>
      ))}
    </View>
  )
}

interface PDFTableRowProps {
  cells: string[]
  isBold?: boolean
  isSectionHeader?: boolean
  indent?: number
}

export function PDFTableRow({
  cells,
  isBold,
  isSectionHeader,
  indent,
}: PDFTableRowProps) {
  const rowStyle = isBold
    ? legacyStyles.tableRowBold
    : isSectionHeader
      ? legacyStyles.sectionHeader
      : legacyStyles.tableRow

  return (
    <View style={rowStyle}>
      {cells.map((cell, i) => (
        <Text
          key={i}
          style={[
            i === 0 ? legacyStyles.cellLabel : legacyStyles.cellAmount,
            isBold || isSectionHeader ? legacyStyles.boldText : {},
            i === 0 && indent ? { paddingLeft: indent * 16 } : {},
          ]}
        >
          {cell}
        </Text>
      ))}
    </View>
  )
}

export function PDFSectionDivider() {
  return <View style={legacyStyles.divider} />
}

export { legacyStyles as pdfStyles }

// Re-export branded components for progressive migration
export {
  BrandedTableHeader,
  BrandedDataRow,
  BrandedSubtotalRow,
  BrandedTotalRow,
  BrandedSectionHeader,
  BrandedSectionDivider,
  formatCellValue,
} from './pdf-table'
export type { PDFColumnDef } from './pdf-table'
