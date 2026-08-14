import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const electron = require('electron')
const result = spawnSync(electron, [process.argv[2]], {
  stdio: 'inherit',
  env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' }
})
process.exit(result.status ?? 1)
