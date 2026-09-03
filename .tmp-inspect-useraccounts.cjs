const XLSX = require('xlsx')
const workbook = XLSX.readFile('datasource/useraccounts.xlsx', { cellDates: false, raw: false })
for (const name of workbook.SheetNames) {
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: '' })
  console.log(JSON.stringify({ sheet: name, rows: rows.slice(0, 12) }))
}
