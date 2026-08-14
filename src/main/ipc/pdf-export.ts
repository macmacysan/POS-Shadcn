import { app, BrowserWindow, dialog, ipcMain } from 'electron'
import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import {
  pdfExportIpcChannels,
  pdfExportRequestSchema,
  pdfPreviewRequestSchema,
  pdfTelegramRequestSchema
} from '../../shared/contracts'
import { AppError, toIpcError } from '../database/errors'
import { TelegramSettingsService } from '../services/telegram-settings-service'

async function createPdf(html: string, fileName: string): Promise<Buffer> {
  const printWindow = new BrowserWindow({
    show: false,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  })
  try {
    await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
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

export function registerPdfExportIpc(telegramSettings: TelegramSettingsService): void {
  ipcMain.handle(pdfExportIpcChannels.preview, async (_event, input: unknown) => {
    try {
      const { html, fileName } = pdfPreviewRequestSchema.parse(input)
      return { pdfBase64: (await createPdf(html, fileName)).toString('base64') }
    } catch (error) {
      throw toIpcError(error)
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
      throw toIpcError(error)
    }
  })

  ipcMain.handle(pdfExportIpcChannels.sendTelegram, async (_event, input: unknown) => {
    try {
      const { pdfBase64, fileName, caption } = pdfTelegramRequestSchema.parse(input)
      const { token, chatId } = await telegramSettings.forDelivery()
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
      if (!response.ok) throw new AppError('DATABASE_ERROR', 'Telegram could not send the report.')
    } catch (error) {
      throw toIpcError(error)
    }
  })
}
