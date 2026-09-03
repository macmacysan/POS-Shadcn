const XLSX = require('D:/MarkDev/POSv2/cashiers-report/node_modules/xlsx');
const wb = XLSX.readFile('INSTALLMENT.xlsx', { cellDates: true });
const rows = name => XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: '', raw: false });
const norm = value => String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const recs = rows('RECORDS').slice(1);
const byAccount = new Map();
for (const r of recs) {
  const key = [r[1], r[2], r[3]].map(norm).join('|');
  if (!byAccount.has(key)) byAccount.set(key, []);
  byAccount.get(key).push(r);
}
const codeToAccount = new Map();
let configLinked = 0, configMissing = 0, configAmbiguous = 0;
for (const r of rows('DATA Config').slice(1)) {
  const account = String(r[0] || '');
  const code = String(r[1] || '').trim();
  if (!account || !code) continue;
  const parts = account.split(',');
  const branch = parts.shift();
  const name = parts.join(' ').trim().split(/\s+/);
  const key = [branch, name.shift(), name.shift()].map(norm).join('|');
  const matches = byAccount.get(key) || [];
  if (matches.length === 1) { codeToAccount.set(code, matches[0]); configLinked++; }
  else if (matches.length > 1) configAmbiguous++;
  else configMissing++;
}
for (const name of ['ACTIVE','CLOSED','BLACKLISTED','LOANITEMS','PAYMENTS']) {
  const start = name === 'ACTIVE' ? 1 : name === 'LOANITEMS' || name === 'PAYMENTS' ? 1 : 2;
  const data = rows(name).slice(start);
  const col = 0;
  let linked = 0, missing = 0;
  for (const r of data) { const code = String(r[col] || '').trim(); if (!code) continue; if (codeToAccount.has(code)) linked++; else missing++; }
  console.log(JSON.stringify({ name, rows: data.length, linked, missing }));
}
const ids = new Map(); for (const r of recs) { const id = String(r[0] || '').trim(); if (!id) continue; ids.set(id, (ids.get(id) || 0) + 1); }
console.log(JSON.stringify({ records: recs.length, duplicateIdCodes: [...ids].filter(([,n]) => n > 1) }));
