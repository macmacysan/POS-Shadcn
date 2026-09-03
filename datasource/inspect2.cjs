const XLSX = require('D:/MarkDev/POSv2/cashiers-report/node_modules/xlsx');
const wb = XLSX.readFile('INSTALLMENT.xlsx', { cellDates: true });
const rows = name => XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', raw: false });
for (const name of ['RECORDS','DATA Config','ACTIVE','CLOSED','BLACKLISTED']) {
  console.log(name, JSON.stringify(rows(name).slice(0, 15)));
}
