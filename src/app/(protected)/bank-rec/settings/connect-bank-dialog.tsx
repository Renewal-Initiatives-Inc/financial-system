'use client'

import { useState, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { usePlaidLink } from 'react-plaid-link'
import { getLinkToken, addBankAccounts } from './actions'
import { toast } from 'sonner'

interface PlaidAccountMeta {
  plaidAccountId: string
  name: string
  mask: string
  type: string
  subtype: string | null
  glAccountId: string
  displayName: string
}

interface ConnectBankDialogProps {
  open: boolean
  onClose: () => void
  glAccountOptions: { id: number; name: string; code: string }[]
  userId: string
}

export function ConnectBankDialog({
  open,
  onClose,
  glAccountOptions,
  userId,
}: ConnectBankDialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [step, setStep] = useState<'plaid-link' | 'assign-accounts' | 'confirm'>(
    'plaid-link'
  )
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [publicToken, setPublicToken] = useState<string | null>(null)
  const [institutionName, setInstitutionName] = useState('')
  const [plaidAccounts, setPlaidAccounts] = useState<PlaidAccountMeta[]>([])
  const [linkInitiated, setLinkInitiated] = useState(false)

  const onPlaidSuccess = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (token: string, metadata: Record<string, any>) => {
      const institution = metadata.institution
      const accounts: PlaidAccountMeta[] = (metadata.accounts ?? []).map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (acc: Record<string, any>) => ({
          plaidAccountId: acc.id,
          name: acc.name ?? 'Account',
          mask: acc.mask ?? '0000',
          type: acc.type ?? 'unknown',
          subtype: acc.subtype ?? null,
          glAccountId: '',
          displayName: acc.name ?? 'Account',
        })
      )
      setPublicToken(token)
      setInstitutionName(institution?.name ?? 'Unknown')
      setPlaidAccounts(accounts)
      setStep('assign-accounts')
    },
    []
  )

  const { open: openPlaid, ready: plaidReady } = usePlaidLink({
    token: linkToken,
    onSuccess: onPlaidSuccess,
    onExit: () => {
      // User closed Plaid Link without connecting
    },
  })

  const handleStartLink = () => {
    startTransition(async () => {
      try {
        const token = await getLinkToken(userId)
        setLinkToken(token)
        setLinkInitiated(true)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to initialize Plaid')
      }
    })
  }

  // Open Plaid Link when token is ready
  if (step === 'plaid-link' && linkToken && plaidReady && linkInitiated) {
    setLinkInitiated(false)
    openPlaid()
  }

  const updateAccountField = (
    index: number,
    field: keyof PlaidAccountMeta,
    value: string
  ) => {
    setPlaidAccounts((prev) =>
      prev.map((acc, i) => (i === index ? { ...acc, [field]: value } : acc))
    )
  }

  const allAccountsAssigned = plaidAccounts.every((acc) => acc.glAccountId !== '')

  const handleConfirm = () => {
    if (!publicToken || plaidAccounts.length === 0) {
      toast.error('Missing connection data. Please try again.')
      resetForm()
      return
    }

    if (!allAccountsAssigned) {
      toast.error('Please assign a GL account to each bank account.')
      return
    }

    startTransition(async () => {
      try {
        await addBankAccounts(
          {
            publicToken,
            institution: institutionName,
            accounts: plaidAccounts.map((acc) => ({
              plaidAccountId: acc.plaidAccountId,
              name: acc.displayName,
              last4: acc.mask,
              type: acc.type,
              glAccountId: parseInt(acc.glAccountId, 10),
            })),
          },
          userId
        )
        toast.success(
          `Connected ${plaidAccounts.length} account${plaidAccounts.length > 1 ? 's' : ''}`
        )
        resetForm()
        onClose()
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to connect')
      }
    })
  }

  const resetForm = () => {
    setStep('plaid-link')
    setLinkToken(null)
    setPublicToken(null)
    setInstitutionName('')
    setPlaidAccounts([])
    setLinkInitiated(false)
  }

  return (
    <Dialog
      open={open && step !== 'plaid-link'}
      onOpenChange={(v) => {
        if (!v) {
          resetForm()
          onClose()
        }
      }}
    >
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>
            {step === 'assign-accounts'
              ? `Assign GL Accounts — ${institutionName}`
              : 'Confirm Connection'}
          </DialogTitle>
        </DialogHeader>

        {step === 'assign-accounts' && (
          <div className="grid gap-4 py-4">
            <p className="text-sm text-muted-foreground">
              Plaid found {plaidAccounts.length} account
              {plaidAccounts.length > 1 ? 's' : ''} at {institutionName}. Assign
              each to a GL cash account.
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Last 4</TableHead>
                  <TableHead>Display Name</TableHead>
                  <TableHead>
                    GL Account <span className="text-destructive">*</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plaidAccounts.map((acc, i) => (
                  <TableRow
                    key={acc.plaidAccountId}
                    data-testid={`plaid-account-row-${i}`}
                  >
                    <TableCell className="font-medium">{acc.name}</TableCell>
                    <TableCell className="capitalize">{acc.subtype ?? acc.type}</TableCell>
                    <TableCell>****{acc.mask}</TableCell>
                    <TableCell>
                      <Input
                        value={acc.displayName}
                        onChange={(e) =>
                          updateAccountField(i, 'displayName', e.target.value)
                        }
                        className="h-8 w-40"
                        data-testid={`plaid-account-name-${i}`}
                      />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={acc.glAccountId}
                        onValueChange={(v) =>
                          updateAccountField(i, 'glAccountId', v)
                        }
                      >
                        <SelectTrigger
                          className="h-8 w-48"
                          data-testid={`plaid-account-gl-${i}`}
                        >
                          <SelectValue placeholder="Select GL account" />
                        </SelectTrigger>
                        <SelectContent>
                          {glAccountOptions.map((a) => (
                            <SelectItem key={a.id} value={String(a.id)}>
                              {a.code} - {a.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {step === 'confirm' && (
          <div className="grid gap-4 py-4">
            <p className="text-sm font-medium">{institutionName}</p>
            {plaidAccounts.map((acc) => (
              <div
                key={acc.plaidAccountId}
                className="rounded-lg border p-3 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-medium">{acc.displayName}</p>
                  <p className="text-xs text-muted-foreground">
                    ****{acc.mask} · {acc.subtype ?? acc.type}
                  </p>
                </div>
                <p className="text-sm text-muted-foreground">
                  →{' '}
                  {glAccountOptions.find(
                    (g) => String(g.id) === acc.glAccountId
                  )?.code ?? 'N/A'}{' '}
                  -{' '}
                  {glAccountOptions.find(
                    (g) => String(g.id) === acc.glAccountId
                  )?.name ?? ''}
                </p>
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              resetForm()
              onClose()
            }}
            data-testid="connect-bank-cancel"
          >
            Cancel
          </Button>
          {step === 'assign-accounts' && (
            <Button
              onClick={() => setStep('confirm')}
              disabled={!allAccountsAssigned}
              data-testid="connect-bank-review"
            >
              Review
            </Button>
          )}
          {step === 'confirm' && (
            <>
              <Button
                variant="outline"
                onClick={() => setStep('assign-accounts')}
                data-testid="connect-bank-back"
              >
                Back
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={isPending}
                data-testid="connect-bank-confirm"
              >
                Save Connection{plaidAccounts.length > 1 ? 's' : ''}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>

      {/* Invisible trigger: when dialog is open and we're on plaid-link step, auto-start */}
      {open && step === 'plaid-link' && !linkToken && !isPending && (
        <AutoStartLink onStart={handleStartLink} />
      )}
    </Dialog>
  )
}

/**
 * Auto-starts Plaid Link token fetch when the dialog opens.
 * Uses a ref to ensure it only fires once per mount.
 */
function AutoStartLink({ onStart }: { onStart: () => void }) {
  const [fired, setFired] = useState(false)
  if (!fired) {
    setFired(true)
    // Schedule after render to avoid setState-during-render
    setTimeout(onStart, 0)
  }
  return null
}
