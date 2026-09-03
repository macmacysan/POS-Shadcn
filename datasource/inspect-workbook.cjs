const XLSX = require('D:/MarkDev/POSv2/cashiers-report/node_modules/xlsx');
const wb = XLSX.readFile('INSTALLMENT.xlsx', { cellDates: true });
for (const name of wb.SheetNames) {
  const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', raw: false });
  console.log(JSON.stringify({ name, rows: rows.length, headers: rows[0] || [], sample: rows.slice(1, 3) }));
}
