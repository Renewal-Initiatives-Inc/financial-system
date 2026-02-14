import { getSecurityDepositRegister } from '@/lib/reports/security-deposit-register'
import { RegisterClient } from './register-client'

export default async function SecurityDepositRegisterPage() {
  const data = await getSecurityDepositRegister()
  return <RegisterClient data={data} />
}
