import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const output = resolve(root, '.local-auth-test-build')
const require = createRequire(import.meta.url)

try {
  execFileSync(
    process.execPath,
    [
      resolve(root, 'node_modules/typescript/bin/tsc'),
      '--target',
      'ES2022',
      '--module',
      'commonjs',
      '--esModuleInterop',
      '--skipLibCheck',
      '--rootDir',
      resolve(root, 'src'),
      '--outDir',
      output,
      resolve(root, 'src/main/database/migrations.ts'),
      resolve(root, 'src/main/database/user-repository.ts'),
      resolve(root, 'src/main/services/auth-service.ts')
    ],
    { stdio: 'inherit' }
  )
  const Database = require('better-sqlite3')
  const { runMigrations } = require(resolve(output, 'main/database/migrations.js'))
  const { UserRepository } = require(resolve(output, 'main/database/user-repository.js'))
  const { AuthService } = require(resolve(output, 'main/services/auth-service.js'))
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  runMigrations(db)
  const users = new UserRepository(db)
  const auth = new AuthService(users)

  users.createAccount({ username: 'local-admin', password: 'admin123', branch: 'Goa', role: 'ADMIN' })
  users.createAccount({ username: 'local-cashier', password: 'cashier123', branch: 'Goa', role: 'CASHIER' })
  users.createAccount({ username: 'multi-cashier', password: 'cashier123', branch: 'Goa', role: 'CASHIER' })

  assert.equal(auth.cashierLoginBranch(), undefined)
  users.setCashierLoginBranch('Tinambac')
  assert.equal(auth.cashierLoginBranch(), 'Tinambac')
  const admin = users.authenticate({ username: 'local-admin', password: 'admin123' })
  assert.equal(admin.role, 'ADMIN')
  assert.equal(admin.branch, 'All Branch')
  await assert.rejects(
    () => auth.login({ username: 'local-cashier', password: 'cashier123' }),
    (error) =>
      error.code === 'FORBIDDEN' &&
      /not assigned to the active cashier branch \(Tinambac\)/.test(error.message)
  )
  const multiCashierId = db
    .prepare('SELECT id FROM users WHERE username = ?')
    .get('multi-cashier').id
  const tinambacId = db.prepare('SELECT id FROM branches WHERE name = ?').get('Tinambac').id
  db.prepare('INSERT INTO user_branch_assignments (user_id, branch_id) VALUES (?, ?)').run(
    multiCashierId,
    tinambacId
  )
  const multiCashier = await auth.login({
    username: 'multi-cashier',
    password: 'cashier123',
    branch: 'Goa'
  })
  assert.equal(multiCashier.role, 'CASHIER')
  assert.equal(multiCashier.branch, 'Tinambac')
  assert.equal(multiCashier.branchId, tinambacId)
  users.setCashierLoginBranch('Goa')
  const cashier = await auth.login({ username: 'local-cashier', password: 'cashier123' })
  assert.equal(cashier.branch, 'Goa')
  assert.equal(
    cashier.branchId,
    db.prepare('SELECT id FROM branches WHERE name = ?').get('Goa').id
  )
  assert.notEqual(
    db.prepare('SELECT password_hash FROM users WHERE username = ?').get('local-admin').password_hash,
    'admin123'
  )
  assert.throws(
    () => users.createAccount({ username: 'local-admin', password: 'another123', branch: 'Goa', role: 'ADMIN' }),
    /already in use/
  )
  assert.throws(
    () => users.authenticate({ username: 'local-cashier', password: 'wrong-password' }),
    /Invalid username or password/
  )

  db.close()
  console.log('local auth tests passed')
} finally {
  if (existsSync(output)) rmSync(output, { recursive: true, force: true })
}
