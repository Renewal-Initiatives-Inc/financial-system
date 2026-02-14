/** Base class for all GL engine errors */
export class GLError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GLError'
  }
}

/** INV-001: Transaction debits do not equal credits */
export class UnbalancedTransactionError extends GLError {
  constructor(totalDebits: number, totalCredits: number) {
    super(
      `Transaction is unbalanced: debits ($${totalDebits.toFixed(2)}) do not equal credits ($${totalCredits.toFixed(2)})`
    )
    this.name = 'UnbalancedTransactionError'
  }
}

/** INV-002/INV-004: Account does not exist or is inactive */
export class InvalidAccountError extends GLError {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidAccountError'
  }
}

/** INV-003: Fund does not exist */
export class InvalidFundError extends GLError {
  constructor(message: string) {
    super(message)
    this.name = 'InvalidFundError'
  }
}

/** INV-006: Transaction cannot be edited (bank-matched) / INV-008: System-generated */
export class ImmutableTransactionError extends GLError {
  constructor(message: string) {
    super(message)
    this.name = 'ImmutableTransactionError'
  }
}

/** Attempt to modify a voided transaction */
export class VoidedTransactionError extends GLError {
  constructor(transactionId: number) {
    super(`Transaction ${transactionId} is voided and cannot be modified`)
    this.name = 'VoidedTransactionError'
  }
}

/** Attempt to reverse an already-reversed transaction */
export class AlreadyReversedError extends GLError {
  constructor(transactionId: number) {
    super(`Transaction ${transactionId} has already been reversed`)
    this.name = 'AlreadyReversedError'
  }
}

/** Transaction not found */
export class TransactionNotFoundError extends GLError {
  constructor(transactionId: number) {
    super(`Transaction ${transactionId} not found`)
    this.name = 'TransactionNotFoundError'
  }
}

/** Entity not found (generic — for accounts, funds) */
export class EntityNotFoundError extends GLError {
  constructor(entityType: string, entityId: number) {
    super(`${entityType} ${entityId} not found`)
    this.name = 'EntityNotFoundError'
  }
}

/** System-locked entity cannot be deactivated */
export class SystemLockedError extends GLError {
  constructor(entityType: string, entityId: number) {
    super(`${entityType} ${entityId} is system-locked and cannot be deactivated`)
    this.name = 'SystemLockedError'
  }
}

/** Fund has non-zero balance and cannot be deactivated (DM-P0-007) */
export class NonZeroBalanceError extends GLError {
  constructor(fundId: number, balance: string) {
    super(
      `Fund ${fundId} has a non-zero balance of $${balance} and cannot be deactivated`
    )
    this.name = 'NonZeroBalanceError'
  }
}
