import { StyleSheet } from '@react-pdf/renderer'

// ---------------------------------------------------------------------------
// Brand Colors — Renewal Initiatives PDF Design System
// ---------------------------------------------------------------------------

export const PDF_COLORS = {
  /** Top banner bar, table header backgrounds, grand-total borders */
  headerBanner: '#1B3A4B',
  /** Secondary accents */
  accent: '#4A6FA5',
  /** Section header row backgrounds */
  sectionBg: '#F0F4F8',
  /** Grand-total row highlight */
  totalRowBg: '#E8EEF4',
  /** Primary body text */
  bodyText: '#1A1A1A',
  /** Meta / muted text */
  mutedText: '#6B7280',
  /** Table grid lines */
  gridLine: '#D1D5DB',
  /** Negative currency values */
  negativeRed: '#DC2626',
  /** Footer / disclaimer text */
  footerText: '#9CA3AF',
  /** Zebra-stripe alternating rows */
  zebraStripe: '#FAFBFC',
  /** White */
  white: '#FFFFFF',
} as const

// ---------------------------------------------------------------------------
// Spacing — consistent margins, padding, line heights
// ---------------------------------------------------------------------------

export const PDF_SPACING = {
  /** Page margins */
  page: { top: 50, bottom: 50, left: 45, right: 45 },
  /** Height of the colored banner bar at top of header */
  bannerHeight: 3,
  /** Space below header before report body */
  headerBottomMargin: 16,
  /** Vertical padding inside table rows */
  rowPaddingV: 3,
  /** Horizontal padding inside table cells */
  cellPaddingH: 6,
  /** Indentation per level (for nested account rows) */
  indentStep: 14,
  /** Space above section headers */
  sectionTopMargin: 6,
  /** Footer distance from bottom edge */
  footerBottom: 24,
} as const

// ---------------------------------------------------------------------------
// Font Sizes — role-based sizing for consistent hierarchy
// ---------------------------------------------------------------------------

export const PDF_FONTS = {
  /** Organization name in header */
  orgName: 13,
  /** Organization subtitle in header */
  orgSubtitle: 7.5,
  /** Report title in header */
  reportTitle: 11,
  /** Date range / fund name in header */
  reportMeta: 8,
  /** Table column headers */
  tableHeader: 8,
  /** Section header rows */
  sectionHeader: 8.5,
  /** Normal body / data rows */
  body: 8.5,
  /** Subtotal / total rows */
  totalRow: 8.5,
  /** Footer text */
  footer: 6.5,
  /** Footer disclaimer */
  disclaimer: 6,
} as const

// ---------------------------------------------------------------------------
// Shared StyleSheet — reusable across all PDF report components
// ---------------------------------------------------------------------------

export const sharedStyles = StyleSheet.create({
  // -- Page --
  page: {
    paddingTop: PDF_SPACING.page.top,
    paddingBottom: PDF_SPACING.page.bottom,
    paddingLeft: PDF_SPACING.page.left,
    paddingRight: PDF_SPACING.page.right,
    fontSize: PDF_FONTS.body,
    fontFamily: 'Helvetica',
    color: PDF_COLORS.bodyText,
  },

  // -- Header --
  bannerBar: {
    height: PDF_SPACING.bannerHeight,
    backgroundColor: PDF_COLORS.headerBanner,
    marginBottom: 8,
    marginTop: -PDF_SPACING.page.top,
    marginLeft: -PDF_SPACING.page.left,
    marginRight: -PDF_SPACING.page.right,
  },
  headerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: PDF_SPACING.headerBottomMargin,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  headerLogo: {
    width: 42,
    height: 42,
  },
  headerOrgBlock: {
    justifyContent: 'center',
  },
  orgName: {
    fontSize: PDF_FONTS.orgName,
    fontFamily: 'Helvetica-Bold',
    color: PDF_COLORS.headerBanner,
  },
  orgSubtitle: {
    fontSize: PDF_FONTS.orgSubtitle,
    color: PDF_COLORS.mutedText,
    marginTop: 1,
  },
  headerRight: {
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  reportTitle: {
    fontSize: PDF_FONTS.reportTitle,
    fontFamily: 'Helvetica-Bold',
    color: PDF_COLORS.headerBanner,
  },
  reportMeta: {
    fontSize: PDF_FONTS.reportMeta,
    color: PDF_COLORS.mutedText,
    marginTop: 2,
  },
  headerDivider: {
    borderBottomWidth: 1,
    borderBottomColor: PDF_COLORS.gridLine,
    marginBottom: 10,
  },

  // -- Footer --
  footer: {
    position: 'absolute',
    bottom: 12,
    left: PDF_SPACING.page.left,
    right: PDF_SPACING.page.right,
  },
  footerDivider: {
    borderBottomWidth: 0.5,
    borderBottomColor: PDF_COLORS.gridLine,
    marginBottom: 4,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    fontSize: PDF_FONTS.footer,
    color: PDF_COLORS.footerText,
  },
  footerDisclaimer: {
    fontSize: PDF_FONTS.disclaimer,
    color: PDF_COLORS.footerText,
    marginTop: 2,
  },

  // -- Table structure --
  tableHeaderRow: {
    flexDirection: 'row',
    backgroundColor: PDF_COLORS.headerBanner,
    paddingVertical: 4,
    paddingHorizontal: PDF_SPACING.cellPaddingH,
  },
  tableHeaderCell: {
    fontFamily: 'Helvetica-Bold',
    fontSize: PDF_FONTS.tableHeader,
    color: PDF_COLORS.white,
  },
  dataRow: {
    flexDirection: 'row',
    paddingVertical: PDF_SPACING.rowPaddingV,
    paddingHorizontal: PDF_SPACING.cellPaddingH,
    borderBottomWidth: 0.5,
    borderBottomColor: PDF_COLORS.gridLine,
  },
  dataRowZebra: {
    flexDirection: 'row',
    paddingVertical: PDF_SPACING.rowPaddingV,
    paddingHorizontal: PDF_SPACING.cellPaddingH,
    borderBottomWidth: 0.5,
    borderBottomColor: PDF_COLORS.gridLine,
    backgroundColor: PDF_COLORS.zebraStripe,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    backgroundColor: PDF_COLORS.sectionBg,
    paddingVertical: 4,
    paddingHorizontal: PDF_SPACING.cellPaddingH,
    marginTop: PDF_SPACING.sectionTopMargin,
  },
  sectionHeaderText: {
    fontFamily: 'Helvetica-Bold',
    fontSize: PDF_FONTS.sectionHeader,
    color: PDF_COLORS.headerBanner,
  },
  subtotalRow: {
    flexDirection: 'row',
    paddingVertical: PDF_SPACING.rowPaddingV,
    paddingHorizontal: PDF_SPACING.cellPaddingH,
    borderTopWidth: 1,
    borderTopColor: PDF_COLORS.gridLine,
  },
  totalRow: {
    flexDirection: 'row',
    paddingVertical: 4,
    paddingHorizontal: PDF_SPACING.cellPaddingH,
    borderTopWidth: 2,
    borderTopColor: PDF_COLORS.headerBanner,
    backgroundColor: PDF_COLORS.totalRowBg,
  },
  boldText: {
    fontFamily: 'Helvetica-Bold',
  },
  cellLeft: {
    textAlign: 'left',
  },
  cellRight: {
    textAlign: 'right',
  },
  cellCenter: {
    textAlign: 'center',
  },
  negativeValue: {
    color: PDF_COLORS.negativeRed,
  },
})
