import { notFound } from 'next/navigation'
import { getDonorById } from '../actions'
import { DonorDetailClient } from './donor-detail-client'

interface DonorDetailPageProps {
  params: Promise<{ id: string }>
}

export default async function DonorDetailPage({
  params,
}: DonorDetailPageProps) {
  const { id } = await params
  const donorId = parseInt(id, 10)

  if (isNaN(donorId)) notFound()

  const donor = await getDonorById(donorId)
  if (!donor) notFound()

  return <DonorDetailClient donor={donor} />
}
