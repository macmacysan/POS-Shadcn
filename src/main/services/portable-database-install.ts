import type { BackupService } from './backup-service'

export function installPortableDatabase(
  service: Pick<BackupService, 'installPortable'>,
  stagedPath: string,
  databasePath: string,
  closeDatabase: () => void,
  relaunch: () => void,
  quit: () => void
): void {
  closeDatabase()
  try {
    service.installPortable(stagedPath, databasePath)
  } catch (error) {
    relaunch()
    quit()
    throw error
  }
  relaunch()
  quit()
}
