const XLSX = require('D:/MarkDev/POSv2/cashiers-report/node_modules/xlsx');
const wb = XLSX.readFile('INSTALLMENT.xlsx', { cellDates: true });
const rows = name => XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', raw: false });
const norm = value => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const recordRows = rows('RECORDS').slice(1);
const recByName = new Map();
for (const r of recordRows) {
  const key = [r[2], r[3], r[4], r[5]].map(norm).join('|');
  if (key.replace(/\|/g, '')) { if (!recByName.has(key)) recByName.set(key, []); recByName.get(key).push(r); }
}
const sources = [
  ['ACTIVE', 2, 1, 0],
  ['CLOSED', 1, null, 0],
  ['BLACKLISTED', 1, null, 0]
];
for (const [sheet, nameCol, branchCol, idCol] of sources) {
  const data = rows(sheet).slice(sheet === 'ACTIVE' ? 1 : 2);
  let unique = 0, ambiguous = 0, missing = 0;
  for (const r of data) {
    const text = String(r[nameCol] || '');
    const parts = text.split(',');
    const last = parts[0] || '';
    const rest = (parts[1] || '').trim().split(/\s+/);
    const key = [last, rest[0], rest.slice(1).join(''), ''].map(norm).join('|');
    const matches = recByName.get(key) || [];
    if (matches.length === 1) unique++; else if (matches.length > 1) ambiguous++; else missing++;
  }
  console.log(JSON.stringify({ sheet, rows: data.length, unique, ambiguous, missing }));
}
