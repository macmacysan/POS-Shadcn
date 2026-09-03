import XLSX from 'xlsx'

const sources = [
  {
    file: 'datasource/🏦 Finance_ Inhouse Installment.xlsx',
    sheets: {
      '👨‍💼 Accounts': 'ACCOUNT',
      Goa: 'ACTIVE_INSTALLMENT',
      Lagonoy: 'ACTIVE_INSTALLMENT',
      Tigaon: 'ACTIVE_INSTALLMENT',
      Tinambac: 'ACTIVE_INSTALLMENT',
      Pasacao: 'REFERENCE',
      Closed: 'CLOSED_INSTALLMENT',
      Blacklisted: 'BLACKLISTED_INSTALLMENT',
      'DATA Loanitems': 'LOAN_ITEM',
      'DATA Payments': 'PAYMENT'
    }
  },
  {
    file: 'datasource/💳 Finance_ Homecredit.xlsx',
    sheets: {
      Goa: 'FINANCE_ACCOUNT',
      Lagonoy: 'FINANCE_ACCOUNT',
      Tigaon: 'FINANCE_ACCOUNT',
      Tinambac: 'FINANCE_ACCOUNT',
      Pasacao: 'FINANCE_ACCOUNT',
      DATALIST: 'REFERENCE'
    }
  }
]

for (const source of sources) {
  const workbook = XLSX.readFile(source.file, { cellDates: true })
  console.log(`\n${source.file}`)
  for (const [sheetName, group] of Object.entries(source.sheets)) {
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) throw new Error(`Missing sheet: ${sheetName}`)
    const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' })
    const nonBlank = rows.slice(1).filter((row) => row.some((value) => String(value).trim() !== ''))
    const dataRows = nonBlank.filter((row) => String(row[0] ?? '').trim() !== '')
    const branch = sheetName === 'Pasacao' ? 'PAS' : sheetName.toUpperCase().slice(0, 3)
    const warning = group === 'REFERENCE' && sheetName === 'Pasacao' ? 'historical-only' : ''
    console.log(`${sheetName}: ${group}, branch=${branch}, dataRows=${dataRows.length}${warning ? `, ${warning}` : ''}`)
  }
}
