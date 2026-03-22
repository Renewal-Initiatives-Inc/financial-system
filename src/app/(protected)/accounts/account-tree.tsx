'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import type { AccountRow } from './actions'

const typeLabels: Record<string, string> = {
  ASSET: 'Asset',
  LIABILITY: 'Liability',
  NET_ASSET: 'Retained Earnings',
  REVENUE: 'Revenue',
  EXPENSE: 'Expense',
}

const typeColors: Record<string, string> = {
  ASSET: 'bg-blue-100 text-blue-800',
  LIABILITY: 'bg-red-100 text-red-800',
  NET_ASSET: 'bg-purple-100 text-purple-800',
  REVENUE: 'bg-green-100 text-green-800',
  EXPENSE: 'bg-orange-100 text-orange-800',
}

interface AccountNode {
  account: AccountRow
  children: AccountNode[]
}

function buildTree(accounts: AccountRow[]): AccountNode[] {
  const nodeMap = new Map<number, AccountNode>()
  const roots: AccountNode[] = []

  for (const account of accounts) {
    nodeMap.set(account.id, { account, children: [] })
  }

  for (const account of accounts) {
    const node = nodeMap.get(account.id)!
    if (account.parentAccountId) {
      const parent = nodeMap.get(account.parentAccountId)
      if (parent) {
        parent.children.push(node)
      } else {
        roots.push(node)
      }
    } else {
      roots.push(node)
    }
  }

  return roots
}

function TreeNode({ node, depth }: { node: AccountNode; depth: number }) {
  const [expanded, setExpanded] = useState(depth === 0)
  const hasChildren = node.children.length > 0

  return (
    <div>
      <div
        className="flex items-center py-1.5 hover:bg-muted/50 rounded-sm"
        style={{ paddingLeft: `${depth * 24 + 8}px` }}
      >
        {hasChildren ? (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mr-1 p-0.5 rounded hover:bg-muted"
            data-testid={`tree-toggle-${node.account.code}`}
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>
        ) : (
          <span className="mr-1 w-5" />
        )}

        <Link
          href={`/accounts/${node.account.id}`}
          className="flex items-center gap-2 text-sm hover:underline flex-1"
          data-testid={`account-tree-link-${node.account.code}`}
        >
          <span className="font-mono text-muted-foreground">
            {node.account.code}
          </span>
          <span>{node.account.name}</span>
          <Badge
            variant="outline"
            className={`text-xs ${typeColors[node.account.type] ?? ''}`}
          >
            {typeLabels[node.account.type]}
          </Badge>
          {!node.account.isActive && (
            <Badge variant="secondary" className="text-xs">
              Inactive
            </Badge>
          )}
        </Link>
      </div>

      {hasChildren && expanded && (
        <div>
          {node.children.map((child) => (
            <TreeNode key={child.account.id} node={child} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  )
}

interface AccountTreeProps {
  accounts: AccountRow[]
}

export function AccountTree({ accounts }: AccountTreeProps) {
  const tree = buildTree(accounts)

  if (tree.length === 0) {
    return (
      <p className="text-muted-foreground text-center py-8">
        No accounts found.
      </p>
    )
  }

  return (
    <div className="rounded-md border p-2" data-testid="account-tree">
      {tree.map((node) => (
        <TreeNode key={node.account.id} node={node} depth={0} />
      ))}
    </div>
  )
}
