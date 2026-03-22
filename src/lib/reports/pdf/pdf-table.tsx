import React from 'react'
import { View, Text } from '@react-pdf/renderer'
import { sharedStyles, PDF_COLORS, PDF_SPACING, PDF_FONTS } from './pdf-theme'
import { formatCurrency, formatPercent } from '../types'

// ---------------------------------------------------------------------------
// Column definition used by all branded table components
// ---------------------------------------------------------------------------

export interface PDFColumnDef {
  label: string
  flex?: number
  align?: 'left' | 'right' | 'center'
  /** Determines formatting & negative-value coloring */
  format?: 'currency' | 'percent' | 'number' | 'date' | 'text'
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function alignStyle(align: 'left' | 'right' | 'center' = 'left') {
  if (align === 'right') return sharedStyles.cellRight
  if (align === 'center') return sharedStyles.cellCenter
  return sharedStyles.cellLeft
}

/** Returns true when a cell string looks like a negative currency value */
function isNegativeValue(cell: string): boolean {
  return cell.startsWith('(') && cell.endsWith(')') && cell.includes('$')
}

// ---------------------------------------------------------------------------
// BrandedTableHeader
// ---------------------------------------------------------------------------

interface BrandedTableHeaderProps {
  columns: PDFColumnDef[]
}

export function BrandedTableHeader({ columns }: BrandedTableHeaderProps) {
  return (
    <View style={sharedStyles.tableHeaderRow}>
      {columns.map((col, i) => (
        <Text
          key={i}
          style={[
            sharedStyles.tableHeaderCell,
            { flex: col.flex ?? (i === 0 ? 3 : 1) },
            alignStyle(col.align ?? (i === 0 ? 'left' : 'right')),
          ]}
        >
          {col.label}
        </Text>
      ))}
    </View>
  )
}

// ---------------------------------------------------------------------------
// BrandedDataRow
// ---------------------------------------------------------------------------

interface BrandedDataRowProps {
  cells: string[]
  columns: PDFColumnDef[]
  rowIndex: number
  indent?: number
}

export function BrandedDataRow({ cells, columns, rowIndex, indent }: BrandedDataRowProps) {
  const isZebra = rowIndex % 2 === 1
  return (
    <View style={isZebra ? sharedStyles.dataRowZebra : sharedStyles.dataRow}>
      {cells.map((cell, i) => {
        const col = columns[i]
        const negative = isNegativeValue(cell)
        return (
          <Text
            key={i}
            style={[
              { flex: col?.flex ?? (i === 0 ? 3 : 1), fontSize: PDF_FONTS.body },
              alignStyle(col?.align ?? (i === 0 ? 'left' : 'right')),
              negative ? sharedStyles.negativeValue : {},
              i === 0 && indent ? { paddingLeft: indent * PDF_SPACING.indentStep } : {},
            ]}
          >
            {cell}
          </Text>
        )
      })}
    </View>
  )
}

// ---------------------------------------------------------------------------
// BrandedSubtotalRow
// ---------------------------------------------------------------------------

interface BrandedSubtotalRowProps {
  cells: string[]
  columns: PDFColumnDef[]
}

export function BrandedSubtotalRow({ cells, columns }: BrandedSubtotalRowProps) {
  return (
    <View style={sharedStyles.subtotalRow}>
      {cells.map((cell, i) => {
        const col = columns[i]
        const negative = isNegativeValue(cell)
        return (
          <Text
            key={i}
            style={[
              sharedStyles.boldText,
              { flex: col?.flex ?? (i === 0 ? 3 : 1), fontSize: PDF_FONTS.totalRow },
              alignStyle(col?.align ?? (i === 0 ? 'left' : 'right')),
              negative ? sharedStyles.negativeValue : {},
            ]}
          >
            {cell}
          </Text>
        )
      })}
    </View>
  )
}

// ---------------------------------------------------------------------------
// BrandedTotalRow
// ---------------------------------------------------------------------------

interface BrandedTotalRowProps {
  cells: string[]
  columns: PDFColumnDef[]
}

export function BrandedTotalRow({ cells, columns }: BrandedTotalRowProps) {
  return (
    <View style={sharedStyles.totalRow}>
      {cells.map((cell, i) => {
        const col = columns[i]
        const negative = isNegativeValue(cell)
        return (
          <Text
            key={i}
            style={[
              sharedStyles.boldText,
              { flex: col?.flex ?? (i === 0 ? 3 : 1), fontSize: PDF_FONTS.totalRow },
              alignStyle(col?.align ?? (i === 0 ? 'left' : 'right')),
              negative ? sharedStyles.negativeValue : {},
            ]}
          >
            {cell}
          </Text>
        )
      })}
    </View>
  )
}

// ---------------------------------------------------------------------------
// BrandedSectionHeader
// ---------------------------------------------------------------------------

interface BrandedSectionHeaderProps {
  title: string
  /** Number of columns — used to span the full row */
  colSpan?: number
}

export function BrandedSectionHeader({ title }: BrandedSectionHeaderProps) {
  return (
    <View style={sharedStyles.sectionHeaderRow}>
      <Text style={sharedStyles.sectionHeaderText}>{title}</Text>
    </View>
  )
}

// ---------------------------------------------------------------------------
// BrandedSectionDivider — thin separator between report sections
// ---------------------------------------------------------------------------

export function BrandedSectionDivider() {
  return (
    <View
      style={{
        borderBottomWidth: 1,
        borderBottomColor: PDF_COLORS.gridLine,
        marginVertical: 6,
      }}
    />
  )
}

// ---------------------------------------------------------------------------
// Helper: format a raw value using a column def
// ---------------------------------------------------------------------------

export function formatCellValue(
  value: unknown,
  format: PDFColumnDef['format'] = 'text'
): string {
  if (value === null || value === undefined) return ''
  if (format === 'currency' && typeof value === 'number') return formatCurrency(value)
  if (format === 'percent' && typeof value === 'number') return formatPercent(value)
  if (format === 'number' && typeof value === 'number') return value.toLocaleString('en-US')
  return String(value)
}
