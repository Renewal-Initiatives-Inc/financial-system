'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/shared/data-table'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ruleColumns } from './columns'
import { CreateRuleDialog } from './create-rule-dialog'
import { deleteCategorizationRule } from './actions'
import { toast } from 'sonner'
import type { CategorizationRuleRow } from './actions'
import type { AccountRow } from '@/app/(protected)/accounts/actions'

interface RulesClientProps {
  initialRules: CategorizationRuleRow[]
  accounts: AccountRow[]
  funds: { id: number; name: string; restrictionType: string; isActive: boolean }[]
}

export function RulesClient({
  initialRules,
  accounts,
  funds,
}: RulesClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [createOpen, setCreateOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<CategorizationRuleRow | null>(
    null
  )
  const [deleteId, setDeleteId] = useState<number | null>(null)

  const handleDelete = () => {
    if (deleteId === null) return
    startTransition(async () => {
      try {
        await deleteCategorizationRule(deleteId)
        toast.success('Rule deleted')
        setDeleteId(null)
        router.refresh()
      } catch (err) {
        if (err instanceof Error) {
          toast.error(err.message)
        }
      }
    })
  }

  // Add action column
  const columnsWithActions = [
    ...ruleColumns,
    {
      id: 'actions',
      header: '',
      cell: ({ row }: { row: { original: CategorizationRuleRow } }) => (
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation()
              setEditingRule(row.original)
            }}
            data-testid={`rule-edit-${row.original.id}`}
          >
            <Pencil className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={(e) => {
              e.stopPropagation()
              setDeleteId(row.original.id)
            }}
            data-testid={`rule-delete-${row.original.id}`}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ),
      enableSorting: false,
    },
  ]

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          Categorization Rules
        </h1>
        <Button
          onClick={() => setCreateOpen(true)}
          data-testid="create-rule-btn"
        >
          <Plus className="mr-2 h-4 w-4" />
          Create Rule
        </Button>
      </div>

      <DataTable
        columns={columnsWithActions}
        data={initialRules}
        emptyMessage="No categorization rules yet."
        testIdPrefix="rules"
      />

      <CreateRuleDialog
        open={createOpen || !!editingRule}
        onClose={() => {
          setCreateOpen(false)
          setEditingRule(null)
        }}
        rule={editingRule}
        accounts={accounts}
        funds={funds}
      />

      <AlertDialog
        open={deleteId !== null}
        onOpenChange={(v) => {
          if (!v) setDeleteId(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Rule</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this categorization rule. Existing
              categorized transactions will not be affected.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="rule-delete-cancel">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isPending}
              data-testid="rule-delete-confirm"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
