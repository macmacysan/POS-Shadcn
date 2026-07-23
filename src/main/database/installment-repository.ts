import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'

import type {
  InstallmentAccountRecord,
  InstallmentBootstrapRequest,
  InstallmentListRequest,
  InstallmentTransitionRequest
} from '../../shared/contracts'
import { AppError } from './errors'

type ContractRow = {
  account_id: string
  account_number: string
  branch_name: string
  last_name: string
  first_name: string
  middle_name?: string
  suffix?: string
  street_subdivision?: string
  barangay: string
  city_municipality: string
  province: string
  occupation?: string
  agent?: string
  referred_by?: string
  account_status: 'ACTIVE' | 'BLACKLISTED'
  blacklisted_at?: string
  blacklist_reason?: string
  account_created_at: string
  account_updated_at: string
  contract_id: string
  contract_status: InstallmentAccountRecord['contractStatus']
  contract_date: string
  date_released: string
  start_date: string
  first_due_date: string
  payment_frequency: 'Weekly' | 'Bi-weekly' | 'Monthly'
  terms: string
  principal_centavos: number
  interest_centavos: number
  down_payment_centavos: number
  fees_centavos: number
  installment_amount_centavos: number
  total_payable_centavos: number
  remarks?: string
  contract_created_at: string
  contract_updated_at: string
  total_paid_centavos: number
  last_payment_date?: string
}

function stringValue(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() : fallback
}

function optionalString(value: unknown): string | undefined {
  const result = stringValue(value)
  return result || undefined
}

function numberValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : Number(value) || 0
}

function centavos(value: unknown): number {
  return Math.max(0, Math.round(numberValue(value) * 100))
}

function dateValue(value: unknown, fallback: string): string {
  const result = stringValue(value, fallback)
  return result.length >= 10 ? result.slice(0, 10) : fallback
}

function branchId(branch: string): string {
  return `branch-${branch.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
}

function branchCode(branch: string): string {
  return branch.slice(0, 3).toUpperCase()
}

function toMeta(row: ContractRow): InstallmentAccountRecord['meta'] {
  const totalPaid = row.total_paid_centavos / 100
  const totalPayable = row.total_payable_centavos / 100
  const outstanding = Math.max(0, totalPayable - totalPaid)
  let status: InstallmentAccountRecord['meta']['status'] = 'active'

  if (row.account_status === 'BLACKLISTED') status = 'blacklisted'
  else if (row.contract_status === 'CLOSED') status = 'closed'
  else if (totalPayable > 0 && outstanding === 0) status = 'fully-paid'
  else if (row.first_due_date) {
    const today = new Date().toISOString().slice(0, 10)
    const due = new Date(`${row.first_due_date}T00:00:00Z`).getTime()
    const now = new Date(`${today}T00:00:00Z`).getTime()
    const days = Math.round((due - now) / 86_400_000)
    if (days < 0) status = 'overdue'
    else if (days === 0) status = 'due-today'
    else if (days <= 7) status = 'due-soon'
  }

  return {
    status,
    nextDue: row.first_due_date || undefined,
    outstandingBalance: outstanding,
    paymentFrequency: row.payment_frequency,
    lastPayment: row.last_payment_date,
    terms: row.terms,
    installmentAmount: row.installment_amount_centavos / 100,
    dateReleased: row.date_released,
    startDate: row.start_date,
    grandTotal: totalPayable,
    principal: row.principal_centavos / 100,
    interest: row.interest_centavos / 100,
    totalInterest: row.interest_centavos / 100,
    downPayment: row.down_payment_centavos / 100,
    requiredFee: row.fees_centavos / 100,
    totalPaid
  }
}

export class InstallmentRepository {
  constructor(private readonly db: Database.Database) {}

  list(request: InstallmentListRequest): { rows: InstallmentAccountRecord[] } {
    const where = ['1 = 1']
    const params: Record<string, string> = {}
    if (request.view === 'active') {
      where.push("c.status = 'ACTIVE'", "a.status = 'ACTIVE'")
    } else if (request.view === 'closed') where.push("c.status = 'CLOSED'")
    else if (request.view === 'blacklisted') where.push("a.status = 'BLACKLISTED'")
    if (request.branch) {
      where.push('b.name = @branch')
      params.branch = request.branch
    }
    if (request.search) {
      where.push('(a.account_number LIKE @search OR a.first_name LIKE @search OR a.last_name LIKE @search)')
      params.search = `%${request.search}%`
    }

    const rows = this.db
      .prepare(
        `SELECT a.id AS account_id, a.account_number, b.name AS branch_name,
                a.last_name, a.first_name, a.middle_name, a.suffix, a.street_subdivision,
                a.barangay, a.city_municipality, a.province, a.occupation, a.agent,
                a.referred_by, a.status AS account_status, a.blacklisted_at,
                a.blacklist_reason, a.created_at AS account_created_at,
                a.updated_at AS account_updated_at, c.id AS contract_id,
                c.status AS contract_status, c.contract_date, c.date_released,
                c.start_date, c.first_due_date, c.payment_frequency, c.terms,
                c.principal_centavos, c.interest_centavos, c.down_payment_centavos,
                c.fees_centavos, c.installment_amount_centavos, c.total_payable_centavos,
                c.remarks, c.created_at AS contract_created_at,
                c.updated_at AS contract_updated_at,
                COALESCE(SUM(CASE WHEN p.status = 'POSTED' THEN pa.allocated_amount_centavos ELSE 0 END), 0)
                  AS total_paid_centavos,
                MAX(CASE WHEN p.status = 'POSTED' THEN p.payment_date END) AS last_payment_date
           FROM accounts a
           JOIN installment_contracts c ON c.account_id = a.id
           JOIN branches b ON b.id = c.branch_id
           LEFT JOIN in_house_payments p ON p.contract_id = c.id
           LEFT JOIN installment_payment_allocations pa ON pa.payment_id = p.id
          WHERE ${where.join(' AND ')}
          GROUP BY c.id
          ORDER BY a.last_name COLLATE NOCASE, a.first_name COLLATE NOCASE, c.contract_date DESC`
      )
      .all(params) as ContractRow[]

    return { rows: rows.map((row) => this.toRecord(row)) }
  }

  bootstrap(request: InstallmentBootstrapRequest): void {
    const now = new Date().toISOString()
    const bootstrap = this.db.transaction(() => {
      const insertBranch = this.db.prepare(
        `INSERT OR IGNORE INTO branches (id, code, name, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?)`
      )
      const findBranch = this.db.prepare(
        'SELECT id FROM branches WHERE name = ? COLLATE NOCASE LIMIT 1'
      )
      const insertAccount = this.db.prepare(
        `INSERT OR IGNORE INTO accounts
          (id, account_number, display_name, last_name, first_name, middle_name, suffix,
           street_subdivision, barangay, city_municipality, province, occupation, agent,
           referred_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      const updateAccount = this.db.prepare(
        `UPDATE accounts SET display_name = ?, last_name = ?, first_name = ?, middle_name = ?,
          suffix = ?, street_subdivision = ?, barangay = ?, city_municipality = ?, province = ?,
          occupation = ?, agent = ?, referred_by = ?, updated_at = ? WHERE id = ?`
      )
      const insertContact = this.db.prepare(
        `INSERT OR IGNORE INTO account_contacts
          (id, account_id, contact_type, contact_kind, contact_value, is_primary, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      const insertContract = this.db.prepare(
        `INSERT OR IGNORE INTO installment_contracts
          (id, account_id, branch_id, installment_type_id, contract_number, contract_date,
           date_released, start_date, first_due_date, payment_frequency, terms,
           principal_centavos, interest_centavos, down_payment_centavos, fees_centavos,
           installment_amount_centavos, financed_amount_centavos, total_payable_centavos,
           remarks, created_at, updated_at)
         VALUES (?, ?, ?, 'installment-type-in-house', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      const insertItem = this.db.prepare(
        `INSERT OR IGNORE INTO installment_items
          (id, contract_id, description, quantity, unit_price_centavos, item_total_centavos, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )

      const loansByCustomer = new Map<string, Record<string, unknown>[]>()
      for (const loan of request.loans) {
        const customerId = stringValue(loan.customerId)
        if (!customerId) continue
        loansByCustomer.set(customerId, [...(loansByCustomer.get(customerId) ?? []), loan])
      }

      for (const account of request.accounts) {
        const id = stringValue(account.id)
        const branch = stringValue(account.branch, 'Lagonoy')
        if (!id) continue
        const accountCreatedAt = stringValue(account.createdAt, now)
        insertBranch.run(branchId(branch), branchCode(branch), branch, accountCreatedAt, now)
        const persistedBranch = findBranch.get(branch) as { id: string } | undefined
        if (!persistedBranch) throw new AppError('DATABASE_ERROR', 'Account branch could not be created.')
        const firstName = stringValue(account.firstName)
        const lastName = stringValue(account.lastName)
        const displayName = `${lastName}, ${firstName}`.replace(/^,\s*/, '')
        const values = [
          id,
          id,
          displayName,
          lastName,
          firstName,
          optionalString(account.middleName) ?? null,
          optionalString(account.suffix) ?? null,
          optionalString(account.streetSubdivision) ?? null,
          stringValue(account.barangay),
          stringValue(account.cityMunicipality),
          stringValue(account.province),
          optionalString(account.occupation) ?? null,
          optionalString(account.agent) ?? null,
          optionalString(account.referredBy) ?? null,
          accountCreatedAt,
          now
        ]
        insertAccount.run(...values)
        updateAccount.run(...values.slice(2, 14), now, id)

        const contacts = Array.isArray(account.contacts) ? account.contacts : []
        for (const contact of contacts) {
          const value = stringValue((contact as Record<string, unknown>).value)
          if (!value) continue
          const kind = stringValue((contact as Record<string, unknown>).kind, 'mobile')
          insertContact.run(
            stringValue((contact as Record<string, unknown>).id, randomUUID()),
            id,
            'PHONE',
            kind,
            value,
            (contact as Record<string, unknown>).isPrimary ? 1 : 0,
            accountCreatedAt,
            now
          )
        }
        const emails = Array.isArray(account.emails) ? account.emails : []
        for (const email of emails) {
          const value = stringValue((email as Record<string, unknown>).value)
          if (!value) continue
          insertContact.run(
            stringValue((email as Record<string, unknown>).id, randomUUID()),
            id,
            'EMAIL',
            'email',
            value,
            (email as Record<string, unknown>).isPrimary ? 1 : 0,
            accountCreatedAt,
            now
          )
        }

        const loans = loansByCustomer.get(id) ?? []
        const sourceLoans = loans.length ? loans : [{ id: `contract-${id}` }]
        for (const loan of sourceLoans) {
          const loanId = stringValue(loan.id, randomUUID())
          const released = dateValue(loan.dateReleased, accountCreatedAt.slice(0, 10))
          const startDate = dateValue(loan.startDate, released)
          const firstDueDate = dateValue(loan.firstDueDate, startDate)
          const paymentFrequency = stringValue(loan.paymentFrequency, 'Monthly')
          const terms = stringValue(loan.terms, '1 month')
          const principal = centavos(loan.principal)
          const interest = centavos(loan.interest)
          const downPayment = centavos(loan.downPayment)
          const fees = centavos(loan.fees)
          const installmentAmount = centavos(loan.installmentAmount)
          const grandTotal = centavos(loan.grandTotal)
          insertContract.run(
            loanId,
            id,
            persistedBranch.id,
            loanId,
            released,
            released,
            startDate,
            firstDueDate,
            paymentFrequency,
            terms,
            principal,
            interest,
            downPayment,
            fees,
            installmentAmount,
            Math.max(0, grandTotal - downPayment),
            grandTotal,
            optionalString(loan.remarks) ?? null,
            stringValue(loan.createdAt, accountCreatedAt),
            now
          )
          const items = Array.isArray(loan.items) ? loan.items : []
          for (const item of items) {
            const itemRecord = item as Record<string, unknown>
            const quantity = Math.max(1, Math.round(numberValue(itemRecord.quantity)))
            const price = centavos(itemRecord.price)
            insertItem.run(
              stringValue(itemRecord.id, randomUUID()),
              loanId,
              stringValue(itemRecord.name, 'Item'),
              quantity,
              price,
              quantity * price,
              now,
              now
            )
          }
        }
      }
    })
    bootstrap()
  }

  closeContract(request: InstallmentTransitionRequest): void {
    const now = new Date().toISOString()
    const transition = this.db.transaction(() => {
      const contract = this.db
        .prepare(
          `SELECT c.id, c.account_id, c.status, c.total_payable_centavos,
                  COALESCE(SUM(CASE WHEN p.status = 'POSTED' THEN pa.allocated_amount_centavos ELSE 0 END), 0) AS paid
             FROM installment_contracts c
             LEFT JOIN in_house_payments p ON p.contract_id = c.id
             LEFT JOIN installment_payment_allocations pa ON pa.payment_id = p.id
            WHERE c.account_id = ? AND (? IS NULL OR c.id = ?)
            GROUP BY c.id
            ORDER BY c.created_at DESC
            LIMIT 1`
        )
        .get(request.accountId, request.contractId ?? null, request.contractId ?? null) as
        | { id: string; account_id: string; status: string; total_payable_centavos: number; paid: number }
        | undefined
      if (!contract) throw new AppError('NOT_FOUND', 'Installment contract was not found.')
      if (contract.status !== 'ACTIVE') throw new AppError('CONFLICT', 'Only active contracts can be closed.')
      if (contract.paid < contract.total_payable_centavos)
        throw new AppError('CONFLICT', 'The contract must have a zero balance before closing.')

      this.db
        .prepare(
          `UPDATE installment_contracts
              SET status = 'CLOSED', closed_at = ?, closed_by_user_id = ?, close_reason = ?, updated_at = ?
            WHERE id = ?`
        )
        .run(now, request.actorUserId, request.remarks, now, contract.id)
      this.writeAudit(
        request.actorUserId,
        'installment_contract',
        contract.id,
        request.remarks,
        'ACTIVE',
        'CLOSED',
        now
      )
      this.db
        .prepare(
          `INSERT INTO installment_activity_history
            (id, contract_id, actor_user_id, action, activity, created_at)
           VALUES (?, ?, ?, 'STATUS_CHANGE', 'Contract closed', ?)`
        )
        .run(randomUUID(), contract.id, request.actorUserId, now)
    })
    transition()
  }

  blacklistAccount(request: InstallmentTransitionRequest): void {
    const now = new Date().toISOString()
    const transition = this.db.transaction(() => {
      const account = this.db.prepare('SELECT status FROM accounts WHERE id = ?').get(request.accountId) as
        | { status: string }
        | undefined
      if (!account) throw new AppError('NOT_FOUND', 'Account was not found.')
      if (account.status === 'BLACKLISTED') throw new AppError('CONFLICT', 'Account is already blacklisted.')
      this.db
        .prepare(
          `UPDATE accounts
              SET status = 'BLACKLISTED', blacklisted_at = ?, blacklisted_by_user_id = ?,
                  blacklist_reason = ?, updated_at = ?
            WHERE id = ?`
        )
        .run(now, request.actorUserId, request.remarks, now, request.accountId)
      this.writeAudit(
        request.actorUserId,
        'account',
        request.accountId,
        request.remarks,
        'ACTIVE',
        'BLACKLISTED',
        now
      )
    })
    transition()
  }

  private writeAudit(
    actorUserId: string,
    entityType: string,
    entityId: string,
    reason: string,
    oldStatus: string,
    newStatus: string,
    now: string
  ): void {
    const auditId = randomUUID()
    this.db
      .prepare(
        `INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, reason, created_at)
         VALUES (?, ?, 'STATUS_CHANGE', ?, ?, ?, ?)`
      )
      .run(auditId, actorUserId, entityType, entityId, reason, now)
    this.db
      .prepare(
        `INSERT INTO audit_log_changes
          (id, audit_log_id, column_name, old_value, new_value)
         VALUES (?, ?, 'status', ?, ?)`
      )
      .run(randomUUID(), auditId, oldStatus, newStatus)
  }

  private toRecord(row: ContractRow): InstallmentAccountRecord {
    const contacts = this.db
      .prepare(
        `SELECT id, contact_kind, contact_value, is_primary
           FROM account_contacts WHERE account_id = ? AND contact_type = 'PHONE'
          ORDER BY is_primary DESC, id`
      )
      .all(row.account_id) as Array<{ id: string; contact_kind?: string; contact_value: string; is_primary: number }>
    const emails = this.db
      .prepare(
        `SELECT id, contact_value, is_primary
           FROM account_contacts WHERE account_id = ? AND contact_type = 'EMAIL'
          ORDER BY is_primary DESC, id`
      )
      .all(row.account_id) as Array<{ id: string; contact_value: string; is_primary: number }>
    const items = this.db
      .prepare(
        `SELECT id, description, quantity, unit_price_centavos
           FROM installment_items WHERE contract_id = ? ORDER BY id`
      )
      .all(row.contract_id) as Array<{
      id: string
      description: string
      quantity: number
      unit_price_centavos: number
    }>

    const account: InstallmentAccountRecord['account'] = {
      id: row.account_id,
      branch: row.branch_name,
      lastName: row.last_name,
      firstName: row.first_name,
      middleName: row.middle_name,
      suffix: row.suffix,
      streetSubdivision: row.street_subdivision,
      barangay: row.barangay,
      cityMunicipality: row.city_municipality,
      province: row.province,
      occupation: row.occupation,
      agent: row.agent,
      referredBy: row.referred_by,
      contacts: contacts.map((contact) => ({
        id: contact.id,
        kind: contact.contact_kind === 'telephone' ? 'telephone' : 'mobile',
        value: contact.contact_value,
        isPrimary: Boolean(contact.is_primary)
      })),
      emails: emails.map((email) => ({
        id: email.id,
        value: email.contact_value,
        isPrimary: Boolean(email.is_primary)
      })),
      createdAt: row.account_created_at,
      updatedAt: row.account_updated_at
    }
    const loan: InstallmentAccountRecord['loan'] = {
      id: row.contract_id,
      customerId: row.account_id,
      dateReleased: row.date_released,
      startDate: row.start_date,
      firstDueDate: row.first_due_date,
      paymentFrequency: row.payment_frequency,
      terms: row.terms,
      principal: row.principal_centavos / 100,
      interest: row.interest_centavos / 100,
      downPayment: row.down_payment_centavos / 100,
      fees: row.fees_centavos / 100,
      installmentAmount: row.installment_amount_centavos / 100,
      grandTotal: row.total_payable_centavos / 100,
      items: items.map((item) => ({
        id: item.id,
        name: item.description,
        quantity: item.quantity,
        price: item.unit_price_centavos / 100
      })),
      remarks: row.remarks,
      createdAt: row.contract_created_at,
      updatedAt: row.contract_updated_at
    }
    return {
      account,
      loan,
      accountStatus: row.account_status,
      contractStatus: row.contract_status,
      contractId: row.contract_id,
      meta: toMeta(row)
    }
  }
}
