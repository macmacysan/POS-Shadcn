import type { DashboardOverview } from '../../shared/contracts'
import type { AppDatabase } from './database'

type Scope = { branch?: string | null; label: string }

export class DashboardRepository {
  constructor(private readonly db: AppDatabase) {}

  getOverview(businessDate: string, rangeDays: 7 | 14 | 30, scope: Scope): DashboardOverview {
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
                COALESCE((SELECT SUM(rt.amount_centavos)
                            FROM daily_receipt_totals rt
                            JOIN daily_reports sales_report ON sales_report.id = rt.daily_report_id
                            JOIN branches sales_branch ON sales_branch.id = sales_report.branch_id
                           WHERE sales_report.business_date = ?
                             AND sales_report.status <> 'VOIDED'
                             AND (? IS NULL OR sales_branch.name = ?)), 0) AS sales_centavos,
                COALESCE(SUM(physical_cash_centavos), 0) AS physical_cash_centavos,
                COALESCE(SUM(cash_remitted_centavos), 0) AS cash_remitted_centavos,
                COALESCE(SUM(physical_cash_centavos - expected_cash_centavos), 0) AS cash_variance_centavos
           FROM report_totals`
      )
      .get(businessDate, branch, branch, businessDate, branch, branch) as {
      report_count: number
      reconciled_report_count: number
      sales_centavos: number
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
    const collectionTrend = this.db
      .prepare(
        `WITH RECURSIVE dates(business_date) AS (
           SELECT date(?, '-' || (? - 1) || ' days')
           UNION ALL
           SELECT date(business_date, '+1 day') FROM dates WHERE business_date < ?
         ),
         sales AS (
           SELECT dr.business_date, SUM(rt.amount_centavos) AS amount_centavos
             FROM daily_receipt_totals rt
             JOIN daily_reports dr ON dr.id = rt.daily_report_id AND dr.status <> 'VOIDED'
             JOIN branches b ON b.id = dr.branch_id
            WHERE dr.business_date BETWEEN date(?, '-' || (? - 1) || ' days') AND ?
              AND (? IS NULL OR b.name = ?)
            GROUP BY dr.business_date
         ),
         in_house AS (
           SELECT p.payment_date AS business_date, SUM(p.amount_centavos) AS amount_centavos
             FROM in_house_payments p
             JOIN installment_contracts c ON c.id = p.contract_id
             JOIN branches b ON b.id = c.branch_id
            WHERE p.status = 'POSTED'
              AND p.payment_date BETWEEN date(?, '-' || (? - 1) || ' days') AND ?
              AND (? IS NULL OR b.name = ?)
            GROUP BY p.payment_date
         ),
         finance AS (
           SELECT COALESCE(paid_date, date_released) AS business_date,
                  SUM(downpayment_centavos) AS amount_centavos
             FROM finance_accounts
            WHERE COALESCE(paid_date, date_released)
                  BETWEEN date(?, '-' || (? - 1) || ' days') AND ?
              AND (? IS NULL OR branch = ?)
            GROUP BY COALESCE(paid_date, date_released)
         )
         SELECT dates.business_date,
                COALESCE(sales.amount_centavos, 0) AS sales_centavos,
                COALESCE(in_house.amount_centavos, 0) AS in_house_centavos,
                COALESCE(finance.amount_centavos, 0) AS finance_centavos
           FROM dates
           LEFT JOIN sales ON sales.business_date = dates.business_date
           LEFT JOIN in_house ON in_house.business_date = dates.business_date
           LEFT JOIN finance ON finance.business_date = dates.business_date
          ORDER BY dates.business_date`
      )
      .all(
        businessDate,
        rangeDays,
        businessDate,
        businessDate,
        rangeDays,
        businessDate,
        branch,
        branch,
        businessDate,
        rangeDays,
        businessDate,
        branch,
        branch,
        businessDate,
        rangeDays,
        businessDate,
        branch,
        branch
      ) as Array<{
      business_date: string
      sales_centavos: number
      in_house_centavos: number
      finance_centavos: number
    }>
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
      .all(businessDate, businessDate, businessDate, branch, branch) as Array<{
      account_id: string
      account_name: string
      branch: DashboardOverview['overdueAccounts'][number]['branch']
      due_date: string
      outstanding_centavos: number
      delayed_days: number
    }>
    const overdueTotals = this.db
      .prepare(
        `SELECT COUNT(*) AS overdue_count,
                COALESCE(SUM(outstanding_centavos), 0) AS overdue_balance_centavos
           FROM (
             SELECT c.id,
                    SUM(s.due_amount_centavos - COALESCE(allocated.paid_centavos, 0))
                      AS outstanding_centavos
               FROM in_house_schedules s
               JOIN installment_contracts c ON c.id = s.contract_id AND c.status = 'ACTIVE'
               JOIN accounts a ON a.id = c.account_id AND a.is_active = 1
               JOIN branches b ON b.id = c.branch_id
               LEFT JOIN (
                 SELECT allocation.schedule_id,
                        SUM(allocation.allocated_amount_centavos) AS paid_centavos
                   FROM installment_payment_allocations allocation
                   JOIN in_house_payments payment ON payment.id = allocation.payment_id
                  WHERE payment.status = 'POSTED' AND payment.payment_date <= ?
                  GROUP BY allocation.schedule_id
               ) allocated ON allocated.schedule_id = s.id
              WHERE s.due_date < ? AND (? IS NULL OR b.name = ?)
              GROUP BY c.id
             HAVING outstanding_centavos > 0
           )`
      )
      .get(businessDate, businessDate, branch, branch) as {
      overdue_count: number
      overdue_balance_centavos: number
    }
    return {
      scopeLabel: scope.label,
      businessDate,
      cashierReportCount: reports.report_count,
      reconciledReportCount: reports.reconciled_report_count,
      salesCentavos: reports.sales_centavos,
      physicalCashCentavos: reports.physical_cash_centavos,
      remittedCashCentavos: reports.cash_remitted_centavos,
      cashVarianceCentavos: reports.cash_variance_centavos,
      inHouseCollectionsCentavos: inHouse.amount_centavos,
      financeCollectionsCentavos: finance.amount_centavos,
      collectionTrend: collectionTrend.map((row) => ({
        businessDate: row.business_date,
        salesCentavos: row.sales_centavos,
        inHouseCollectionsCentavos: row.in_house_centavos,
        financeCollectionsCentavos: row.finance_centavos
      })),
      overdueCount: overdueTotals.overdue_count,
      overdueBalanceCentavos: overdueTotals.overdue_balance_centavos,
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
