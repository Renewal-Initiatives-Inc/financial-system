import { describe, it, expect } from 'vitest'
import { generateCSV } from '../csv/export-csv'

describe('generateCSV', () => {
  it('generates header row from columns', () => {
    const csv = generateCSV(['Name', 'Amount'], [])
    expect(csv).toContain('Name,Amount')
  })

  it('includes UTF-8 BOM for Excel compatibility', () => {
    const csv = generateCSV(['A'], [])
    expect(csv.charCodeAt(0)).toBe(0xfeff)
  })

  it('formats number values to 2 decimal places', () => {
    const csv = generateCSV(['Value'], [{ Value: 1234.567 }])
    expect(csv).toContain('1234.57')
  })

  it('handles null and undefined values as empty', () => {
    const csv = generateCSV(['A', 'B'], [{ A: null, B: undefined }])
    const lines = csv.split('\r\n')
    expect(lines[1]).toBe(',')
  })

  it('escapes commas in field values', () => {
    const csv = generateCSV(['Name'], [{ Name: 'Smith, John' }])
    expect(csv).toContain('"Smith, John"')
  })

  it('escapes double quotes in field values', () => {
    const csv = generateCSV(['Name'], [{ Name: 'The "Best" Fund' }])
    expect(csv).toContain('"The ""Best"" Fund"')
  })

  it('escapes newlines in field values', () => {
    const csv = generateCSV(['Notes'], [{ Notes: 'Line 1\nLine 2' }])
    expect(csv).toContain('"Line 1\nLine 2"')
  })

  it('handles multiple rows correctly', () => {
    const csv = generateCSV(['Name', 'Amount'], [
      { Name: 'Revenue', Amount: 5000 },
      { Name: 'Expenses', Amount: 3000 },
    ])
    const lines = csv.split('\r\n')
    expect(lines).toHaveLength(3) // header + 2 data rows
    expect(lines[1]).toBe('Revenue,5000.00')
    expect(lines[2]).toBe('Expenses,3000.00')
  })

  it('handles string values without quotes when no special chars', () => {
    const csv = generateCSV(['Name'], [{ Name: 'Simple' }])
    expect(csv).toContain('\r\nSimple')
    expect(csv).not.toContain('"Simple"')
  })

  it('uses CRLF line endings', () => {
    const csv = generateCSV(['A'], [{ A: 'row1' }, { A: 'row2' }])
    expect(csv).toContain('\r\n')
  })

  it('handles empty data rows', () => {
    const csv = generateCSV(['A', 'B'], [])
    const lines = csv.split('\r\n')
    expect(lines).toHaveLength(1) // just header
  })

  it('handles zero amounts', () => {
    const csv = generateCSV(['Amount'], [{ Amount: 0 }])
    expect(csv).toContain('0.00')
  })

  it('handles negative amounts', () => {
    const csv = generateCSV(['Amount'], [{ Amount: -500.5 }])
    expect(csv).toContain('-500.50')
  })

  it('preserves integer values as .00', () => {
    const csv = generateCSV(['Amount'], [{ Amount: 1000 }])
    expect(csv).toContain('1000.00')
  })

  it('handles carriage return in field values', () => {
    const csv = generateCSV(['Notes'], [{ Notes: 'Line 1\rLine 2' }])
    expect(csv).toContain('"Line 1\rLine 2"')
  })
})
