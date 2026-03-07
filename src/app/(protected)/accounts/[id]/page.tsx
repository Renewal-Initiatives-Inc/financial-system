import { notFound } from 'next/navigation'
import { getAccountById, getAccountBalanceDetail } from '../actions'
import { AccountDetailClient } from './account-detail-client'

interface AccountDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function AccountDetailPage({ params }: AccountDetailPageProps) {
  const { id } = await params
  const accountId = parseInt(id, 10)

  if (isNaN(accountId)) notFound()

  const [account, balanceDetail] = await Promise.all([
    getAccountById(accountId),
    getAccountBalanceDetail(accountId),
  ])

  if (!account) notFound()

  return <AccountDetailClient account={account} balanceDetail={balanceDetail} />
}
