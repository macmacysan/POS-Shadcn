import { app, dialog, ipcMain } from 'electron'
import { existsSync, readdirSync, statSync, unlinkSync } from 'node:fs'
import { basename, join } from 'node:path'
import { randomBytes } from 'node:crypto'
import {
  backupIpcChannels,
  backupRestoreRequestSchema,
  onlineBackupRestoreRequestSchema,
  onlineBackupRevisionRequestSchema,
  portableDatabaseConfirmationRequestSchema
} from '../../shared/contracts'
import { toIpcError } from '../database/errors'
import { AuthService } from '../services/auth-service'
import { BackupService } from '../services/backup-service'
import { OnlineBackupRevisionService } from '../services/online-backup-revision-service'

const portableImportLifetimeMs = 15 * 60 * 1000
const portableStageName = /^\.portable-import-[a-f0-9]{16}\.db$/

type PortableImport = {
  stagedPath: string
  fileName: string
  schemaVersion: number
  expiresAt: number
}
type DialogApi = Pick<typeof dialog, 'showSaveDialog' | 'showOpenDialog'>

export class PortableDatabaseController {
  private readonly imports = new Map<string, PortableImport>()
  private readonly stagingDirectory: string

  constructor(
    userDataPath: string,
    private readonly service: BackupService,
    private readonly auth: AuthService,
    private readonly install: (stagedPath: string) => void,
    private readonly dialogs: DialogApi = dialog,
    private readonly now: () => number = Date.now,
    private readonly documentsDirectory: () => string = () => app.getPath('documents')
  ) {
    this.stagingDirectory = join(userDataPath, 'portable-imports')
    this.cleanExpired()
    const timer = setInterval(() => this.cleanExpired(), portableImportLifetimeMs)
    timer.unref()
  }

  async export(): Promise<{ fileName: string; schemaVersion: number } | undefined> {
    this.auth.requireAdmin()
    const fileName = `cashiers-report-${new Date().toISOString().slice(0, 10)}.db`
    const result = await this.dialogs.showSaveDialog({
      title: 'Export Whole Database',
      defaultPath: join(this.documentsDirectory(), fileName),
      filters: [{ name: 'Cashiers Report database', extensions: ['db'] }]
    })
    if (result.canceled || !result.filePath) return undefined
    const exported = await this.service.exportPortableFile(result.filePath)
    return { fileName: basename(exported.filePath), schemaVersion: exported.schemaVersion }
  }

  async select(): Promise<{ token: string; fileName: string; schemaVersion: number } | undefined> {
    this.auth.requireAdmin()
    const result = await this.dialogs.showOpenDialog({
      title: 'Import Whole Database',
      properties: ['openFile'],
      filters: [{ name: 'Cashiers Report database', extensions: ['db'] }]
    })
    const sourcePath = result.filePaths[0]
    if (result.canceled || !sourcePath) return undefined
    const prepared = this.service.preparePortableImport(sourcePath, this.stagingDirectory)
    const token = randomBytes(16).toString('hex')
    this.imports.set(token, {
      stagedPath: prepared.stagedPath,
      fileName: basename(sourcePath),
      schemaVersion: prepared.schemaVersion,
      expiresAt: this.now() + portableImportLifetimeMs
    })
    return { token, fileName: basename(sourcePath), schemaVersion: prepared.schemaVersion }
  }

  cancel(token: string): void {
    this.auth.requireAdmin()
    this.consume(token, true)
  }

  confirm(token: string): void {
    this.auth.requireAdmin()
    const prepared = this.consume(token, false)
    try {
      this.install(prepared.stagedPath)
    } finally {
      if (existsSync(prepared.stagedPath)) unlinkSync(prepared.stagedPath)
    }
  }

  cleanExpired(): void {
    const now = this.now()
    for (const [token, prepared] of this.imports) {
      if (prepared.expiresAt <= now) {
        this.imports.delete(token)
        if (existsSync(prepared.stagedPath)) unlinkSync(prepared.stagedPath)
      }
    }
    if (!existsSync(this.stagingDirectory)) return
    for (const name of readdirSync(this.stagingDirectory)) {
      const path = join(this.stagingDirectory, name)
      if (portableStageName.test(name) && statSync(path).mtimeMs + portableImportLifetimeMs <= now)
        unlinkSync(path)
    }
  }

  private consume(token: string, removeStaged: boolean): PortableImport {
    const prepared = this.imports.get(token)
    if (!prepared) throw new Error('Portable database confirmation is no longer available.')
    this.imports.delete(token)
    const expired = prepared.expiresAt <= this.now()
    if (removeStaged || expired) {
      if (existsSync(prepared.stagedPath)) unlinkSync(prepared.stagedPath)
    }
    if (expired) throw new Error('Portable database confirmation has expired.')
    return prepared
  }
}

export function registerBackupIpc(
  service: BackupService,
  revisions: OnlineBackupRevisionService,
  auth: AuthService,
  installRevision: (stagedPath: string) => void,
  installPortable: (stagedPath: string) => void
): void {
  const portable = new PortableDatabaseController(
    app.getPath('userData'),
    service,
    auth,
    installPortable
  )
  ipcMain.handle(backupIpcChannels.create, async () => {
    try {
      auth.requireAdmin()
      return await service.createManaged(join(app.getPath('userData'), 'backups'))
    } catch (error) {
      throw toIpcError(error)
    }
  })
  ipcMain.handle(backupIpcChannels.restore, async (_event, input: unknown) => {
    try {
      auth.requireAdmin()
      return service.restoreManaged(backupRestoreRequestSchema.parse(input).id)
    } catch (error) {
      throw toIpcError(error)
    }
  })
  ipcMain.handle(backupIpcChannels.exportPortable, async () => {
    try {
      return await portable.export()
    } catch (error) {
      throw toIpcError(error)
    }
  })
  ipcMain.handle(backupIpcChannels.selectPortableImport, async () => {
    try {
      return await portable.select()
    } catch (error) {
      throw toIpcError(error)
    }
  })
  ipcMain.handle(backupIpcChannels.cancelPortableImport, (_event, input: unknown) => {
    try {
      portable.cancel(portableDatabaseConfirmationRequestSchema.parse(input).token)
    } catch (error) {
      throw toIpcError(error)
    }
  })
  ipcMain.handle(backupIpcChannels.confirmPortableImport, (_event, input: unknown) => {
    try {
      portable.confirm(portableDatabaseConfirmationRequestSchema.parse(input).token)
    } catch (error) {
      throw toIpcError(error)
    }
  })
  ipcMain.handle(backupIpcChannels.listOnlineRevisions, async (_event, input: unknown) => {
    try {
      auth.requireAdmin()
      return await revisions.list(onlineBackupRevisionRequestSchema.parse(input).branch)
    } catch (error) {
      throw toIpcError(error)
    }
  })
  ipcMain.handle(backupIpcChannels.restoreOnlineRevision, async (_event, input: unknown) => {
    try {
      auth.requireAdmin()
      const request = onlineBackupRestoreRequestSchema.parse(input)
      installRevision(await revisions.stageRestore(request.id, request.branch))
    } catch (error) {
      throw toIpcError(error)
    }
  })
}
