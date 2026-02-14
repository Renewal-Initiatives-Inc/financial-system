import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ColumnDef } from '@tanstack/react-table'
import { DataTable } from './data-table'

interface TestRow {
  id: number
  name: string
  value: number
}

const columns: ColumnDef<TestRow, unknown>[] = [
  {
    accessorKey: 'id',
    header: 'ID',
  },
  {
    accessorKey: 'name',
    header: 'Name',
    enableSorting: true,
  },
  {
    accessorKey: 'value',
    header: 'Value',
    enableSorting: true,
  },
]

const testData: TestRow[] = [
  { id: 1, name: 'Alpha', value: 100 },
  { id: 2, name: 'Beta', value: 200 },
  { id: 3, name: 'Charlie', value: 50 },
]

describe('DataTable', () => {
  it('renders table with provided columns and data', () => {
    render(<DataTable columns={columns} data={testData} />)

    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
    expect(screen.getByText('Charlie')).toBeInTheDocument()
  })

  it('displays empty state when no data', () => {
    render(
      <DataTable columns={columns} data={[]} emptyMessage="No data found." />
    )

    expect(screen.getByTestId('empty-state')).toHaveTextContent('No data found.')
  })

  it('displays default empty message', () => {
    render(<DataTable columns={columns} data={[]} />)

    expect(screen.getByTestId('empty-state')).toHaveTextContent('No results.')
  })

  it('calls onRowClick when a row is clicked', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()

    render(
      <DataTable columns={columns} data={testData} onRowClick={onClick} />
    )

    const rows = screen.getAllByTestId('table-row')
    await user.click(rows[0])

    expect(onClick).toHaveBeenCalledWith(testData[0])
  })

  it('renders pagination controls', () => {
    render(<DataTable columns={columns} data={testData} />)

    expect(screen.getByText(/row\(s\) total/)).toBeInTheDocument()
    expect(screen.getByText('Rows per page')).toBeInTheDocument()
  })

  it('renders correct row count', () => {
    render(<DataTable columns={columns} data={testData} />)

    expect(screen.getByText('3 row(s) total')).toBeInTheDocument()
  })

  it('paginates when data exceeds page size', () => {
    // Generate 30 items with pageSize of 10
    const manyRows: TestRow[] = Array.from({ length: 30 }, (_, i) => ({
      id: i + 1,
      name: `Item ${i + 1}`,
      value: i * 10,
    }))

    render(<DataTable columns={columns} data={manyRows} pageSize={10} />)

    // Should show "Page 1 of 3"
    expect(screen.getByText(/Page 1 of 3/)).toBeInTheDocument()
    // Should show 10 rows (first page)
    const rows = screen.getAllByTestId('table-row')
    expect(rows).toHaveLength(10)
  })
})
