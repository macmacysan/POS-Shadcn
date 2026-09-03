import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import {
  pdfExportIpcChannels,
  pdfExportRequestSchema,
  pdfPreviewRequestSchema,
  pdfTelegramRequestSchema
  ,excelExportRequestSchema
} from '../../shared/contracts'
import { AppError, toIpcError } from '../database/errors'
import { TelegramSettingsService } from '../services/telegram-settings-service'

function throwIpcError(error: unknown): never {
  const payload = toIpcError(error)
  const ipcError = new Error(payload.message)
  Object.assign(ipcError, { code: payload.code })
  throw ipcError
}

async function createPdf(html: string, fileName: string): Promise<Buffer> {
  const printWindow = new BrowserWindow({
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  })
  try {
    await printWindow.loadURL('about:blank')
    await printWindow.webContents.executeJavaScript(
      `document.open();document.write(${JSON.stringify(html)});document.close();void 0`,
      true
    )
    return await printWindow.webContents.printToPDF({
      pageSize: 'A4',
      printBackground: false,
      displayHeaderFooter: true,
      headerTemplate: '<span></span>',
      footerTemplate: `<div style="width:100%;font-size:8px;color:#555;text-align:center">${fileName} · Page <span class="pageNumber"></span> of <span class="totalPages"></span></div>`
    })
  } finally {
    if (!printWindow.isDestroyed()) printWindow.destroy()
  }
}

function pdfFromBase64(pdfBase64: string): Buffer {
  const pdf = Buffer.from(pdfBase64, 'base64')
  if (pdf.subarray(0, 5).toString() !== '%PDF-')
    throw new AppError('VALIDATION_ERROR', 'Invalid PDF data.')
  return pdf
}

function workbookFromBase64(workbookBase64: string): Buffer {
  const workbook = Buffer.from(workbookBase64, 'base64')
  if (workbook.subarray(0, 2).toString('hex') !== '504b')
    throw new AppError('VALIDATION_ERROR', 'Invalid Excel workbook data.')
  return workbook
}

export function registerPdfExportIpc(telegramSettings: TelegramSettingsService): void {
  ipcMain.handle(pdfExportIpcChannels.preview, async (_event, input: unknown) => {
    try {
      const { html, fileName } = pdfPreviewRequestSchema.parse(input)
      return { pdfBase64: (await createPdf(html, fileName)).toString('base64') }
    } catch (error) {
      throwIpcError(error)
    }
  })

  ipcMain.handle(pdfExportIpcChannels.save, async (event, input: unknown) => {
    try {
      const { pdfBase64, fileName } = pdfExportRequestSchema.parse(input)
      const parent = BrowserWindow.fromWebContents(event.sender)
      const saveOptions = {
        defaultPath: join(app.getPath('documents'), fileName),
        filters: [{ name: 'PDF', extensions: ['pdf'] }]
      }
      const selection = parent
        ? await dialog.showSaveDialog(parent, saveOptions)
        : await dialog.showSaveDialog(saveOptions)
      if (selection.canceled || !selection.filePath) return { canceled: true }

      await writeFile(selection.filePath, pdfFromBase64(pdfBase64))
      return { canceled: false }
    } catch (error) {
      throwIpcError(error)
    }
  })

  ipcMain.handle(pdfExportIpcChannels.sendTelegram, async (_event, input: unknown) => {
    try {
      const { pdfBase64, fileName, caption } = pdfTelegramRequestSchema.parse(input)
      const { token, chatIds } = await telegramSettings.forDelivery()
      for (const chatId of chatIds) {
        const form = new FormData()
        form.set('chat_id', chatId)
        form.set('caption', caption)
        form.set(
          'document',
          new Blob([Uint8Array.from(pdfFromBase64(pdfBase64))], { type: 'application/pdf' }),
          fileName
        )
        const response = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
          method: 'POST',
          body: form,
          signal: AbortSignal.timeout(15_000)
        })
        const result = await response.json().catch(() => undefined) as { ok?: boolean; description?: string } | undefined
        if (!response.ok || result?.ok !== true) {
          throw new AppError('DATABASE_ERROR', result?.description || 'Telegram could not send the report.')
        }
      }
    } catch (error) {
      throwIpcError(error)
    }
  })

  ipcMain.handle(pdfExportIpcChannels.saveExcel, async (event, input: unknown) => {
    try {
      const { workbookBase64, fileName } = excelExportRequestSchema.parse(input)
      const parent = BrowserWindow.fromWebContents(event.sender)
      const saveOptions = { defaultPath: join(app.getPath('documents'), fileName), filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }] }
      const selection = parent ? await dialog.showSaveDialog(parent, saveOptions) : await dialog.showSaveDialog(saveOptions)
      if (selection.canceled || !selection.filePath) return { canceled: true }
      await writeFile(selection.filePath, workbookFromBase64(workbookBase64))
      return { canceled: false }
    } catch (error) {
      throwIpcError(error)
    }
  })
}
