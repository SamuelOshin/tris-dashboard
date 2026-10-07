import { csvField, buildCsv } from '../../../frontend/components/manufacturing/material-cost/export-csv.ts'
const cases: [any, string][] = [
  ['plain', 'plain'], ['a,b', '"a,b"'], ['say "hi"', '"say ""hi"""'], ['line\nbreak', '"line\nbreak"'],
  ['=SUM(A1)', "'=SUM(A1)"], ['+1', "'+1"], ['-cmd', "'-cmd"], ['@x', "'@x"], [-5.5, '-5.5'], [0, '0'], [null, ''], [undefined, ''],
]
let bad = 0
for (const [input, want] of cases) { const got = csvField(input); if (got !== want) { bad++; console.log('FAIL', JSON.stringify(input), JSON.stringify(got), JSON.stringify(want)) } }
const csv = buildCsv([{ material_id: 'M,1', description: '=evil()', category: null, currency: 'USD', unit_of_measure: 'kg', latest_price: 1, price_change_1m_pct: -2, price_change_3m_pct: null, vs_standard_pct: null, spend_window_total: 5, top_supplier: null, top_supplier_share_pct: null, coverage_days: null, signals: [{ name: 'S1', status: 'triggered' }, { name: 'S2', status: 'clear' }] } as any], {}, {}, { as_of: '2026-01-01', computed_at: 'x' })
console.log(csv.split('\r\n')[1])
console.log(bad ? 'FAILED' : 'ALL OK')
