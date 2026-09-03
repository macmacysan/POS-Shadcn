import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const source = readFileSync(resolve(import.meta.dirname, '../src/renderer/src/contexts/active-report-context.tsx'), 'utf8')
const effect = source.slice(source.indexOf('React.useEffect'), source.indexOf('if (error)'))

assert.match(effect, /if \(user\.role === 'ADMIN'\) return/)
console.log('admin active-report guard test passed')
