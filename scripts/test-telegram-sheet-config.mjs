import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { existsSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..')
const output = resolve(root, '.telegram-settings-test-build')
const require = createRequire(import.meta.url)

try {
  execFileSync(process.execPath, [
    resolve(root, 'node_modules/typescript/bin/tsc'),
    '--target', 'ES2022', '--module', 'commonjs', '--esModuleInterop', '--skipLibCheck',
    '--rootDir', resolve(root, 'src'), '--outDir', output,
    resolve(root, 'src/main/services/telegram-settings-service.ts'),
    resolve(root, 'src/main/database/errors.ts'),
    resolve(root, 'src/main/services/google-sheets-client.ts'),
    resolve(root, 'src/shared/contracts/auth.ts')
  ], { stdio: 'inherit' })

  const { TelegramSettingsService } = require(resolve(output, 'main/services/telegram-settings-service.js'))
  const calls = []
  const sheets = {
    async values(spreadsheetId, range) {
      calls.push([spreadsheetId, range])
      return [['-1001234567890', '123456789:abcdefghijklmnopqrstuvwxyz_ABCDEF']]
    }
  }
  const settings = new TelegramSettingsService(sheets, 'credential-sheet')
  assert.deepEqual(await settings.forDelivery(), {
    chatIds: ['-1001234567890'],
    token: '123456789:abcdefghijklmnopqrstuvwxyz_ABCDEF'
  })
  assert.deepEqual(calls, [['credential-sheet', 'TELEGRAM_config!B2:C7']])
  console.log('telegram sheet configuration tests passed')
} finally {
  if (existsSync(output)) rmSync(output, { recursive: true, force: true })
}
