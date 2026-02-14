'use client'

import { useState, useTransition, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { usePlaidLink } from 'react-plaid-link'
import { getLinkToken, addBankAccount } from './actions'
import { toast } from 'sonner'

interface ConnectBankDialogProps {
  open: boolean
  onClose: () => void
  glAccountOptions: { id: number; name: string; code: string }[]
}

export function ConnectBankDialog({
  open,
  onClose,
  glAccountOptions,
}: ConnectBankDialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [step, setStep] = useState<'select-account' | 'plaid-link' | 'confirm'>(
    'select-account'
  )
  const [glAccountId, setGlAccountId] = useState<string>('')
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [plaidData, setPlaidData] = useState<{
    publicToken: string
    institutionName: string
    accountName: string
    accountMask: string
  } | null>(null)
  const [accountName, setAccountName] = useState('')

  const onPlaidSuccess = useCallback(
    (publicToken: string, metadata: any) => {
      const account = metadata.accounts?.[0]
      const institution = metadata.institution
      setPlaidData({
        publicToken,
        institutionName: institution?.name ?? 'Unknown',
        accountName: account?.name ?? 'Bank Account',
        accountMask: account?.mask ?? '0000',
      })
      setAccountName(account?.name ?? 'Bank Account')
      setStep('confirm')
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
    if (!glAccountId) {
      toast.error('Please select a GL account first')
      return
    }

    startTransition(async () => {
      try {
        const token = await getLinkToken('system')
        setLinkToken(token)
        setStep('plaid-link')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to initialize Plaid')
      }
    })
  }

  // Open Plaid Link when token is ready
  if (step === 'plaid-link' && linkToken && plaidReady) {
    openPlaid()
  }

  const handleConfirm = () => {
    if (!plaidData || !glAccountId) return

    startTransition(async () => {
      try {
        await addBankAccount(
          {
            publicToken: plaidData.publicToken,
            name: accountName || plaidData.accountName,
            institution: plaidData.institutionName,
            last4: plaidData.accountMask,
            glAccountId: parseInt(glAccountId, 10),
          },
          'system'
        )
        toast.success('Bank account connected')
        resetForm()
        onClose()
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to connect')
      }
    })
  }

  const resetForm = () => {
    setStep('select-account')
    setGlAccountId('')
    setLinkToken(null)
    setPlaidData(null)
    setAccountName('')
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          resetForm()
          onClose()
        }
      }}
    >
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Connect Bank Account</DialogTitle>
        </DialogHeader>

        {step === 'select-account' && (
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>
                GL Account <span className="text-destructive">*</span>
              </Label>
              <p className="text-sm text-muted-foreground">
                Select the GL cash account this bank account maps to.
              </p>
              <Select value={glAccountId} onValueChange={setGlAccountId}>
                <SelectTrigger data-testid="connect-bank-gl-account">
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
            </div>
          </div>
        )}

        {step === 'confirm' && plaidData && (
          <div className="grid gap-4 py-4">
            <div className="rounded-lg border p-4 space-y-2">
              <p className="text-sm font-medium">
                {plaidData.institutionName}
              </p>
              <p className="text-sm text-muted-foreground">
                Account ending in ****{plaidData.accountMask}
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="account-name">Display Name</Label>
              <Input
                id="account-name"
                value={accountName}
                onChange={(e) => setAccountName(e.target.value)}
                placeholder="e.g., Operating Checking"
                data-testid="connect-bank-name"
              />
            </div>
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
          {step === 'select-account' && (
            <Button
              onClick={handleStartLink}
              disabled={isPending || !glAccountId}
              data-testid="connect-bank-link-btn"
            >
              Connect via Plaid
            </Button>
          )}
          {step === 'confirm' && (
            <Button
              onClick={handleConfirm}
              disabled={isPending}
              data-testid="connect-bank-confirm"
            >
              Save Connection
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
