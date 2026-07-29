import type { DashboardOverview } from '../../shared/contracts'
import type { AppDatabase } from './database'

type Scope = { branch?: string; label: string }

export class DashboardRepository {
  constructor(private readonly db: AppDatabase) {}

  getOverview(businessDate: string, scope: Scope): DashboardOverview {
    const branch = scope.branch ?? null
    const reports = this.db
      .prepare(
        `WITH report_totals AS (
           SELECT dr.id,
                  dr.cash_remitted_centavos,
                  dr.opening_cash_centavos
                    + COALESCE((SELECT SUM(amount_centavos) FROM daily_receipt_totals
                                 WHERE daily_report_id = dr.id), 0)
                    + COALESCE((SELECT SUM(amount_centavos) FROM income_entries
                                 WHERE daily_report_id = dr.id AND status = 'POSTED'), 0)
                    - COALESCE((SELECT SUM(amount_centavos) FROM daily_report_deductions
                                 WHERE daily_report_id = dr.id), 0)
                    - COALESCE((SELECT SUM(amount_centavos) FROM cash_out_entries
                                 WHERE daily_report_id = dr.id AND status = 'POSTED'), 0)
                    - COALESCE((SELECT SUM(amount_centavos) FROM expenses
                                 WHERE report_id = dr.id AND status = 'POSTED'), 0)
                    AS expected_cash_centavos,
                  COALESCE((SELECT SUM(d.value_centavos * c.quantity)
                              FROM daily_report_cash_counts c
                              JOIN cash_denominations d ON d.id = c.denomination_id
                             WHERE c.daily_report_id = dr.id), 0) AS physical_cash_centavos,
                  EXISTS(SELECT 1 FROM daily_report_cash_counts c WHERE c.daily_report_id = dr.id)
                    AS has_cash_count
             FROM daily_reports dr
             JOIN branches b ON b.id = dr.branch_id
            WHERE dr.business_date = ?
              AND dr.status <> 'VOIDED'
              AND (? IS NULL OR b.name = ?)
         )
         SELECT COUNT(*) AS report_count,
                COALESCE(SUM(has_cash_count), 0) AS reconciled_report_count,
                COALESCE(SUM(physical_cash_centavos), 0) AS physical_cash_centavos,
                COALESCE(SUM(cash_remitted_centavos), 0) AS cash_remitted_centavos,
                COALESCE(SUM(physical_cash_centavos - expected_cash_centavos), 0) AS cash_variance_centavos
           FROM report_totals`
      )
      .get(businessDate, branch, branch) as {
      report_count: number
      reconciled_report_count: number
      physical_cash_centavos: number
      cash_remitted_centavos: number
      cash_variance_centavos: number
    }
    const inHouse = this.db
      .prepare(
        `SELECT COALESCE(SUM(p.amount_centavos), 0) AS amount_centavos
           FROM in_house_payments p
           JOIN installment_contracts c ON c.id = p.contract_id
           JOIN branches b ON b.id = c.branch_id
          WHERE p.status = 'POSTED' AND p.payment_date = ? AND (? IS NULL OR b.name = ?)`
      )
      .get(businessDate, branch, branch) as { amount_centavos: number }
    const finance = this.db
      .prepare(
        `SELECT COALESCE(SUM(downpayment_centavos), 0) AS amount_centavos
           FROM finance_accounts
          WHERE COALESCE(paid_date, date_released) = ? AND (? IS NULL OR branch = ?)`
      )
      .get(businessDate, branch, branch) as { amount_centavos: number }
    const overdueRows = this.db
      .prepare(
        `SELECT a.id AS account_id, a.display_name AS account_name, b.name AS branch,
                MIN(s.due_date) AS due_date,
                SUM(s.due_amount_centavos - COALESCE(allocated.paid_centavos, 0)) AS outstanding_centavos,
                CAST(julianday(?) - julianday(MIN(s.due_date)) AS INTEGER) AS delayed_days
           FROM in_house_schedules s
           JOIN installment_contracts c ON c.id = s.contract_id AND c.status = 'ACTIVE'
           JOIN accounts a ON a.id = c.account_id AND a.is_active = 1
           JOIN branches b ON b.id = c.branch_id
           LEFT JOIN (
             SELECT allocation.schedule_id, SUM(allocation.allocated_amount_centavos) AS paid_centavos
               FROM installment_payment_allocations allocation
               JOIN in_house_payments payment ON payment.id = allocation.payment_id
              WHERE payment.status = 'POSTED' AND payment.payment_date <= ?
              GROUP BY allocation.schedule_id
           ) allocated ON allocated.schedule_id = s.id
          WHERE s.due_date < ? AND (? IS NULL OR b.name = ?)
          GROUP BY c.id
         HAVING SUM(s.due_amount_centavos - COALESCE(allocated.paid_centavos, 0)) > 0
          ORDER BY delayed_days DESC, outstanding_centavos DESC, account_name ASC
          LIMIT 8`
      )
      .all(businessDate, businessDate, branch, branch) as Array<{
      account_id: string
      account_name: string
      branch: DashboardOverview['overdueAccounts'][number]['branch']
      due_date: string
      outstanding_centavos: number
      delayed_days: number
    }>
    return {
      scopeLabel: scope.label,
      businessDate,
      cashierReportCount: reports.report_count,
      reconciledReportCount: reports.reconciled_report_count,
      physicalCashCentavos: reports.physical_cash_centavos,
      remittedCashCentavos: reports.cash_remitted_centavos,
      cashVarianceCentavos: reports.cash_variance_centavos,
      inHouseCollectionsCentavos: inHouse.amount_centavos,
      financeCollectionsCentavos: finance.amount_centavos,
      overdueCount: overdueRows.length,
      overdueBalanceCentavos: overdueRows.reduce(
        (total, row) => total + row.outstanding_centavos,
        0
      ),
      overdueAccounts: overdueRows.map((row) => ({
        accountId: row.account_id,
        accountName: row.account_name,
        branch: row.branch,
        dueDate: row.due_date,
        outstandingCentavos: row.outstanding_centavos,
        delayedDays: row.delayed_days
      }))
    }
  }
}
