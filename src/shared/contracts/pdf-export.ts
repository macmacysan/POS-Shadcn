import { z } from 'zod'

export const pdfPreviewRequestSchema = z.object({
  html: z.string().min(1).max(2_000_000),
  fileName: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,140}\.pdf$/)
})

export const pdfPreviewResponseSchema = z.object({
  pdfBase64: z.string().min(1).max(10_000_000)
})

export const pdfExportRequestSchema = z.object({
  pdfBase64: z.string().min(1).max(10_000_000),
  fileName: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,140}\.pdf$/)
})

export const pdfExportResponseSchema = z.object({ canceled: z.boolean() })

export const pdfTelegramRequestSchema = z.object({
  pdfBase64: z.string().min(1).max(10_000_000),
  fileName: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,140}\.pdf$/),
  caption: z.string().max(1_024)
})

export type PdfExportRequest = z.infer<typeof pdfExportRequestSchema>
export type PdfExportResponse = z.infer<typeof pdfExportResponseSchema>
export type PdfPreviewRequest = z.infer<typeof pdfPreviewRequestSchema>
export type PdfPreviewResponse = z.infer<typeof pdfPreviewResponseSchema>
export type PdfTelegramRequest = z.infer<typeof pdfTelegramRequestSchema>

export const pdfExportIpcChannels = {
  preview: 'pdf-export:preview',
  save: 'pdf-export:save',
  sendTelegram: 'pdf-export:send-telegram'
} as const

export type PdfExportApi = {
  pdfExport: {
    preview(request: PdfPreviewRequest): Promise<PdfPreviewResponse>
    save(request: PdfExportRequest): Promise<PdfExportResponse>
    sendTelegram(request: PdfTelegramRequest): Promise<void>
  }
}
