'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, RefreshCw, Power } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ConnectBankDialog } from './connect-bank-dialog'
import { deactivateBankAccount, triggerManualSync } from './actions'
import { toast } from 'sonner'
import type { BankAccountRow } from './actions'

interface BankAccountsClientProps {
  initialAccounts: BankAccountRow[]
  glAccountOptions: { id: number; name: string; code: string }[]
}

export function BankAccountsClient({
  initialAccounts,
  glAccountOptions,
}: BankAccountsClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [connectOpen, setConnectOpen] = useState(false)
  const [syncingId, setSyncingId] = useState<number | null>(null)

  const handleSync = (accountId: number) => {
    setSyncingId(accountId)
    startTransition(async () => {
      try {
        const result = await triggerManualSync(accountId, 'system')
        toast.success(
          `Synced: ${result.added} added, ${result.modified} modified`
        )
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Sync failed')
      } finally {
        setSyncingId(null)
      }
    })
  }

  const handleDeactivate = (accountId: number, name: string) => {
    if (!confirm(`Disconnect "${name}"? This will stop syncing transactions.`)) {
      return
    }
    startTransition(async () => {
      try {
        await deactivateBankAccount(accountId, 'system')
        toast.success('Bank account disconnected')
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to disconnect')
      }
    })
  }

  const activeAccounts = initialAccounts.filter((a) => a.isActive)
  const inactiveAccounts = initialAccounts.filter((a) => !a.isActive)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          Bank Account Settings
        </h1>
        <Button
          onClick={() => setConnectOpen(true)}
          data-testid="connect-bank-btn"
        >
          <Plus className="mr-2 h-4 w-4" />
          Connect Bank Account
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Connected Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          {activeAccounts.length === 0 ? (
            <p
              className="text-sm text-muted-foreground text-center py-8"
              data-testid="bank-accounts-empty"
            >
              No bank accounts connected. Click "Connect Bank Account" to get
              started.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Institution</TableHead>
                  <TableHead>Last 4</TableHead>
                  <TableHead>GL Account</TableHead>
                  <TableHead>Transactions</TableHead>
                  <TableHead>Last Sync</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeAccounts.map((account) => (
                  <TableRow
                    key={account.id}
                    data-testid={`bank-account-row-${account.id}`}
                  >
                    <TableCell className="font-medium">
                      {account.name}
                    </TableCell>
                    <TableCell>{account.institution}</TableCell>
                    <TableCell>****{account.last4}</TableCell>
                    <TableCell>{account.glAccountName}</TableCell>
                    <TableCell>{account.transactionCount}</TableCell>
                    <TableCell>
                      {account.lastSyncDate ?? (
                        <span className="text-muted-foreground">Never</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSync(account.id)}
                          disabled={isPending && syncingId === account.id}
                          data-testid={`sync-bank-${account.id}`}
                        >
                          <RefreshCw
                            className={`mr-1 h-3 w-3 ${
                              syncingId === account.id ? 'animate-spin' : ''
                            }`}
                          />
                          Sync Now
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            handleDeactivate(account.id, account.name)
                          }
                          disabled={isPending}
                          data-testid={`disconnect-bank-${account.id}`}
                        >
                          <Power className="mr-1 h-3 w-3" />
                          Disconnect
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {inactiveAccounts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg text-muted-foreground">
              Disconnected Accounts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Institution</TableHead>
                  <TableHead>Last 4</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inactiveAccounts.map((account) => (
                  <TableRow key={account.id} className="opacity-50">
                    <TableCell>{account.name}</TableCell>
                    <TableCell>{account.institution}</TableCell>
                    <TableCell>****{account.last4}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">Disconnected</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <ConnectBankDialog
        open={connectOpen}
        onClose={() => setConnectOpen(false)}
        glAccountOptions={glAccountOptions}
      />
    </div>
  )
}
