import fs from 'node:fs'
import path from 'node:path'
import XLSX from 'xlsx'

const root = process.cwd()
const datasource = path.join(root, 'datasource')
const outputFile = path.join(datasource, 'combined-inhouse-payments.xlsx')
const branchCodes = new Map([
  ['GOA', 'GOA'], ['GOA', 'GOA'], ['LAGONOY', 'LAG'], ['LAG', 'LAG'],
  ['TIGAON', 'TIG'], ['TIG', 'TIG'], ['TINAMBAC', 'TIN'], ['TIN', 'TIN'],
  ['PASACAO', 'PAS'], ['PAS', 'PAS']
])

const text = (value) => String(value ?? '').trim()
const key = (value) => text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
const compact = (value) => key(value).replaceAll(' ', '')
const firstToken = (value) => key(value).split(' ')[0] ?? ''
const rowsOf = (sheet) => XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' })
const nonHeaderRows = (rows) => rows.filter((row) => {
  const first = key(row[0])
  return first && !['idcode', 'code', 'account', 'accounts', 'customer'].includes(first)
})

function branchFrom(value) {
  const normalized = key(value).replaceAll(' ', '').toUpperCase()
  return branchCodes.get(normalized) ?? null
}

function branchFromAccount(account) {
  const direct = branchFrom(account.branch)
  if (text(account.branch)) return direct
  const prefix = text(account.accountId).toUpperCase().split(/[-_]/)[0]
  return branchCodes.get(prefix) ?? null
}

function nameParts(value) {
  const [last = '', rest = ''] = text(value).split(',', 2)
  const tokens = key(rest).split(' ').filter(Boolean)
  return { last: key(last), first: tokens[0] ?? '', middle: tokens.slice(1) }
}

function accountName(account) {
  return { last: key(account.lastName), first: firstToken(account.firstName), middle: key(account.middleName).split(' ').filter(Boolean) }
}

function nameMatches(account, customer) {
  const a = accountName(account)
  const c = nameParts(customer)
  return compact(a.last) === compact(c.last) && a.first === c.first
}

function findAccount(accounts, customer) {
  const matches = accounts.filter((account) => nameMatches(account, customer))
  if (matches.length <= 1) return matches[0] ?? null
  const customerParts = nameParts(customer)
  const customerFirstName = customerParts.first + customerParts.middle.join('')
  const exact = matches.filter((account) => compact(account.firstName) === customerFirstName)
  if (exact.length === 1) return exact[0]
  return matches.find((account) => {
    const middle = accountName(account).middle
    return customerParts.middle.some((token) => token.length === 1 && middle.some((candidate) => candidate.startsWith(token)))
  }) ?? null
}

function readSources() {
  const inhouseName = fs.readdirSync(datasource).find((name) => /Inhouse Installment\.xlsx$/i.test(name))
  if (!inhouseName) throw new Error('Missing in-house installment workbook')
  const inhouseFile = path.join(datasource, inhouseName)
  const inhouse = XLSX.readFile(inhouseFile, { cellDates: true })
  const accountSheetName = inhouse.SheetNames.find((name) => /Accounts/i.test(name))
  if (!accountSheetName) throw new Error('Missing Accounts sheet')
  const accounts = nonHeaderRows(rowsOf(inhouse.Sheets[accountSheetName])).map((row, index) => ({
    accountId: text(row[0]), branch: text(row[1]), lastName: text(row[2]), firstName: text(row[3]), middleName: text(row[4]),
    sourceRow: index + 2
  }))
  const installmentSheets = inhouse.SheetNames.filter((name) => ['Goa', 'Lagonoy', 'Tigaon', 'Tinambac', 'Pasacao', 'Closed', 'Blacklisted'].includes(name))
  const installments = installmentSheets.flatMap((sheetName) => nonHeaderRows(rowsOf(inhouse.Sheets[sheetName])).map((row, index) => ({
    installmentId: text(row[0]), customerName: text(row[1]), sourceSheet: sheetName, sourceRow: index + 2
  })))
  const paymentWorkbook = XLSX.readFile(path.join(datasource, 'payments.csv'), { cellDates: true })
  const paymentRows = nonHeaderRows(rowsOf(paymentWorkbook.Sheets[paymentWorkbook.SheetNames[0]]))
  const payments = paymentRows.map((row, index) => ({
    sourceRow: index + 2, installmentId: text(row[0]), paymentCustomer: text(row[1]), paymentDate: text(row[2]), amount: text(row[3]),
    orNumber: text(row[4]), penalty: text(row[5]), paymentMethod: text(row[6]), encoder: text(row[7]), collector: text(row[8]), notes: text(row[9])
  }))
  const legacyPaymentCustomers = new Map(nonHeaderRows(rowsOf(inhouse.Sheets['DATA Payments'])).map((row) => [text(row[0]), text(row[1])]))
  return { accounts, installments, payments, legacyPaymentCustomers }
}

function buildWorkbook({ accounts, installments, payments, legacyPaymentCustomers }) {
  const installmentById = new Map(installments.map((record) => [record.installmentId, record]))
  const linked = []
  const unresolved = []
  const seenSourceKeys = new Set()
  const duplicateSourceKeys = []

  for (const payment of payments) {
    const sourceKey = `payments.csv|Payments|${payment.sourceRow}`
    if (seenSourceKeys.has(sourceKey)) duplicateSourceKeys.push(sourceKey)
    seenSourceKeys.add(sourceKey)
    const installment = installmentById.get(payment.installmentId) ?? (legacyPaymentCustomers.has(payment.installmentId) ? { installmentId: payment.installmentId, customerName: legacyPaymentCustomers.get(payment.installmentId), sourceSheet: 'DATA Payments' } : null)
    const account = installment ? findAccount(accounts, installment.customerName) : null
    const branch = account ? branchFromAccount(account) : null
    const reason = !installment ? 'Installment IDCODE not found' : !account ? 'Customer not found in Accounts sheet' : !branch ? 'Branch is blank and account ID prefix is unknown' : null
    if (reason) {
      unresolved.push({
        'Payment Source Row': payment.sourceRow, 'Payment Installment IDCODE': payment.installmentId, 'Payment Customer': payment.paymentCustomer,
        'Payment Date': payment.paymentDate, Amount: payment.amount, 'OR Number': payment.orNumber, Penalty: payment.penalty,
        'Payment Method': payment.paymentMethod, Encoder: payment.encoder, Collector: payment.collector, Notes: payment.notes, Reason: reason
      })
      continue
    }
    linked.push({
      'Payment Source Row': payment.sourceRow, 'Payment Installment IDCODE': payment.installmentId, 'Payment Customer': payment.paymentCustomer,
      'Payment Date': payment.paymentDate, Amount: payment.amount, 'OR Number': payment.orNumber, Penalty: payment.penalty,
      'Payment Method': payment.paymentMethod, Encoder: payment.encoder, Collector: payment.collector, Notes: payment.notes,
      'Customer Name': installment.customerName, 'Account ID': account.accountId, 'Installment ID': installment.installmentId, Branch: branch,
      'Installment Sheet': installment.sourceSheet
    })
  }

  const workbook = XLSX.utils.book_new()
  const linkedSheet = XLSX.utils.json_to_sheet(linked)
  const unresolvedSheet = XLSX.utils.json_to_sheet(unresolved)
  linkedSheet['!autofilter'] = { ref: linkedSheet['!ref'] }
  unresolvedSheet['!autofilter'] = { ref: unresolvedSheet['!ref'] }
  XLSX.utils.book_append_sheet(workbook, linkedSheet, 'Combined Payments')
  XLSX.utils.book_append_sheet(workbook, unresolvedSheet, 'Unmatched Review')
  XLSX.writeFile(workbook, outputFile)
  const written = XLSX.readFile(outputFile)
  if (written.SheetNames.join('|') !== 'Combined Payments|Unmatched Review') throw new Error('Generated workbook has unexpected sheets')
  for (const [sheetName, expectedHeaders] of [['Combined Payments', Object.keys(linked[0] ?? {})], ['Unmatched Review', Object.keys(unresolved[0] ?? {})]]) {
    const actualHeaders = rowsOf(written.Sheets[sheetName])[0] ?? []
    if (actualHeaders.join('|') !== expectedHeaders.join('|')) throw new Error(`Generated workbook has unexpected headers in ${sheetName}`)
  }

  const countsByBranch = Object.fromEntries([...new Set(linked.map((row) => row.Branch))].sort().map((branch) => [branch, linked.filter((row) => row.Branch === branch).length]))
  const unresolvedByReason = Object.fromEntries([...new Set(unresolved.map((row) => row.Reason))].map((reason) => [reason, unresolved.filter((row) => row.Reason === reason).length]))
  const validation = {
    totalSourcePayments: payments.length, linkedPayments: linked.length, unresolvedPayments: unresolved.length,
    countsByBranch, unresolvedByReason, unresolvedExamples: [...new Map(unresolved.map((row) => [row['Payment Installment IDCODE'], row])).values()].slice(0, 20), duplicatePaymentSourceKeys: duplicateSourceKeys, linkedRowsMissingRequiredFields: linked.filter((row) => ['Installment ID', 'Customer Name', 'Account ID', 'Branch'].some((field) => !text(row[field]))).length,
    outputSheets: workbook.SheetNames, outputHeaders: { 'Combined Payments': Object.keys(linked[0] ?? {}), 'Unmatched Review': Object.keys(unresolved[0] ?? {}) }
  }
  if (validation.duplicatePaymentSourceKeys.length || validation.linkedRowsMissingRequiredFields || validation.totalSourcePayments !== validation.linkedPayments + validation.unresolvedPayments) throw new Error(`Validation failed: ${JSON.stringify(validation)}`)
  console.log(JSON.stringify({ outputFile: path.relative(root, outputFile), ...validation }, null, 2))
}

buildWorkbook(readSources())
