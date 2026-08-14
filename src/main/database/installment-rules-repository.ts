import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import type { InstallmentRules, InstallmentRulesRecord } from '../../shared/contracts'

type VersionRow = { id: string; version: number; standard_interest_rate_bps: number; required_down_payment_rate_bps: number; created_at: string; created_by_user_id?: string }
type TermRow = { frequency: 'Daily' | 'Weekly' | 'Semi' | 'Monthly'; terms: number; interest_rate_bps?: number; required_fee_payments?: number }

export class InstallmentRulesRepository {
  constructor(private readonly db: Database.Database) {}
  getActive(): InstallmentRulesRecord {
    const row = this.db.prepare(`SELECT id, version, standard_interest_rate_bps, required_down_payment_rate_bps, created_at, created_by_user_id FROM installment_rule_versions WHERE is_active = 1`).get() as VersionRow
    return this.toRecord(row)
  }
  list(): InstallmentRulesRecord[] {
    return (this.db.prepare(`SELECT id, version, standard_interest_rate_bps, required_down_payment_rate_bps, created_at, created_by_user_id FROM installment_rule_versions ORDER BY version DESC`).all() as VersionRow[]).map((row) => this.toRecord(row))
  }
  save(input: InstallmentRules, actorUserId: string): InstallmentRulesRecord {
    const now = new Date().toISOString(); const id = randomUUID()
    const save = this.db.transaction(() => {
      const version = (this.db.prepare('SELECT COALESCE(MAX(version), 0) + 1 AS version FROM installment_rule_versions').get() as { version: number }).version
      this.db.prepare('UPDATE installment_rule_versions SET is_active = 0 WHERE is_active = 1').run()
      this.db.prepare(`INSERT INTO installment_rule_versions (id, version, is_active, standard_interest_rate_bps, required_down_payment_rate_bps, created_by_user_id, created_at) VALUES (?, ?, 1, ?, ?, ?, ?)`).run(id, version, input.standardInterestRateBps, input.requiredDownPaymentRateBps, actorUserId, now)
      const insert = this.db.prepare(`INSERT INTO installment_rule_terms (version_id, frequency, terms, interest_rate_bps, required_fee_payments) VALUES (?, ?, ?, ?, ?)`)
      input.dailyPlans.forEach((plan) => insert.run(id, 'Daily', plan.terms, null, plan.requiredFeePayments))
      input.weeklyTerms.forEach((terms) => insert.run(id, 'Weekly', terms, null, null))
      input.semiTerms.forEach((terms) => insert.run(id, 'Semi', terms, null, null))
      input.monthlyPlans.forEach((plan) => insert.run(id, 'Monthly', plan.terms, plan.interestRateBps, null))
      const auditId = randomUUID(); this.db.prepare(`INSERT INTO audit_logs (id, actor_user_id, action, entity_type, entity_id, reason, created_at) VALUES (?, ?, 'CREATE', 'installment_rule_version', ?, 'Installment rules activated', ?)`).run(auditId, actorUserId, id, now)
    }); save(); return this.getActive()
  }
  private toRecord(row: VersionRow): InstallmentRulesRecord {
    const terms = this.db.prepare(`SELECT frequency, terms, interest_rate_bps, required_fee_payments FROM installment_rule_terms WHERE version_id = ? ORDER BY frequency, terms`).all(row.id) as TermRow[]
    return { id: row.id, version: row.version, standardInterestRateBps: row.standard_interest_rate_bps, requiredDownPaymentRateBps: row.required_down_payment_rate_bps, monthlyPlans: terms.filter((term) => term.frequency === 'Monthly').map((term) => ({ terms: term.terms, interestRateBps: term.interest_rate_bps ?? 0 })), dailyPlans: terms.filter((term) => term.frequency === 'Daily').map((term) => ({ terms: term.terms, requiredFeePayments: term.required_fee_payments ?? 0 })), weeklyTerms: terms.filter((term) => term.frequency === 'Weekly').map((term) => term.terms), semiTerms: terms.filter((term) => term.frequency === 'Semi').map((term) => term.terms), createdAt: row.created_at, createdByUserId: row.created_by_user_id }
  }
}
