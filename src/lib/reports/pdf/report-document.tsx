import React from 'react'
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 9,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 20,
  },
  orgName: {
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 2,
  },
  orgAddress: {
    fontSize: 8,
    color: '#666',
    marginBottom: 12,
  },
  reportTitle: {
    fontSize: 12,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 4,
  },
  reportMeta: {
    fontSize: 8,
    color: '#666',
    marginBottom: 2,
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    marginVertical: 8,
  },
  table: {
    marginTop: 8,
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
  indented: {
    paddingLeft: 16,
  },
  footer: {
    position: 'absolute',
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: 7,
    color: '#999',
  },
})

interface ReportDocumentProps {
  title: string
  dateRange?: string
  fundName?: string | null
  generatedAt?: string
  children: React.ReactNode
}

export function ReportDocument({
  title,
  dateRange,
  fundName,
  generatedAt,
  children,
}: ReportDocumentProps) {
  const timestamp = generatedAt ?? new Date().toISOString()

  return (
    <Document>
      <Page size="LETTER" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.orgName}>Renewal Initiatives Inc.</Text>
          <Text style={styles.orgAddress}>
            Property Management &amp; Nonprofit Financial System
          </Text>
          <Text style={styles.reportTitle}>{title}</Text>
          {dateRange && <Text style={styles.reportMeta}>{dateRange}</Text>}
          <Text style={styles.reportMeta}>
            Fund: {fundName ?? 'Consolidated'}
          </Text>
          <Text style={styles.reportMeta}>
            Generated: {new Date(timestamp).toLocaleString('en-US')}
          </Text>
        </View>
        <View style={styles.divider} />
        {children}
        <View style={styles.footer} fixed>
          <Text>Renewal Initiatives Inc.</Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  )
}

// Reusable PDF table components

interface PDFTableHeaderProps {
  columns: { label: string; flex?: number }[]
}

export function PDFTableHeader({ columns }: PDFTableHeaderProps) {
  return (
    <View style={styles.tableHeaderRow}>
      {columns.map((col, i) => (
        <Text
          key={i}
          style={[
            i === 0 ? styles.cellLabel : styles.cellAmount,
            styles.headerText,
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

export function PDFTableRow({ cells, isBold, isSectionHeader, indent }: PDFTableRowProps) {
  const rowStyle = isBold
    ? styles.tableRowBold
    : isSectionHeader
      ? styles.sectionHeader
      : styles.tableRow

  return (
    <View style={rowStyle}>
      {cells.map((cell, i) => (
        <Text
          key={i}
          style={[
            i === 0 ? styles.cellLabel : styles.cellAmount,
            isBold || isSectionHeader ? styles.boldText : {},
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
  return <View style={styles.divider} />
}

export { styles as pdfStyles }
