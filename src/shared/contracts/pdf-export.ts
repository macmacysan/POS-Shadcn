import { z } from '../zod'

const pdfHtmlMaxLength = 10_000_000
const pdfBase64MaxLength = 50_000_000

export const pdfPreviewRequestSchema = z.object({
  html: z.string().min(1).max(pdfHtmlMaxLength),
  fileName: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9 .,_-]{0,140}\.pdf$/)
})

export const pdfPreviewResponseSchema = z.object({
  pdfBase64: z.string().min(1).max(pdfBase64MaxLength)
})

export const pdfExportRequestSchema = z.object({
  pdfBase64: z.string().min(1).max(pdfBase64MaxLength),
  fileName: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9 .,_-]{0,140}\.pdf$/)
})

export const pdfExportResponseSchema = z.object({ canceled: z.boolean() })

export const pdfTelegramRequestSchema = z.object({
  pdfBase64: z.string().min(1).max(pdfBase64MaxLength),
  fileName: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9 .,_-]{0,140}\.pdf$/),
  caption: z.string().max(1_024)
})

export const excelExportRequestSchema = z.object({
  workbookBase64: z.string().min(1).max(20_000_000),
  fileName: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9 .,_-]{0,140}\.xlsx$/)
})

export type PdfExportRequest = z.infer<typeof pdfExportRequestSchema>
export type PdfExportResponse = z.infer<typeof pdfExportResponseSchema>
export type PdfPreviewRequest = z.infer<typeof pdfPreviewRequestSchema>
export type PdfPreviewResponse = z.infer<typeof pdfPreviewResponseSchema>
export type PdfTelegramRequest = z.infer<typeof pdfTelegramRequestSchema>
export type ExcelExportRequest = z.infer<typeof excelExportRequestSchema>

export const pdfExportIpcChannels = {
  preview: 'pdf-export:preview',
  save: 'pdf-export:save',
  sendTelegram: 'pdf-export:send-telegram'
  ,saveExcel: 'pdf-export:save-excel'
} as const

export type PdfExportApi = {
  pdfExport: {
    preview(request: PdfPreviewRequest): Promise<PdfPreviewResponse>
    save(request: PdfExportRequest): Promise<PdfExportResponse>
    sendTelegram(request: PdfTelegramRequest): Promise<void>
    saveExcel(request: ExcelExportRequest): Promise<PdfExportResponse>
  }
}
