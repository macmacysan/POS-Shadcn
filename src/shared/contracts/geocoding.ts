import { z } from '../zod'

const addressPartSchema = z.string().trim().min(1).max(200)

export const geocodeRequestSchema = z.object({
  barangay: addressPartSchema.optional(),
  cityMunicipality: addressPartSchema.optional(),
  province: addressPartSchema
})

export const geocodeResultSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180)
})

export type GeocodeRequest = z.infer<typeof geocodeRequestSchema>
export type GeocodeResult = z.infer<typeof geocodeResultSchema>

export const geocodingIpcChannels = {
  forward: 'geocoding:forward'
} as const

export type GeocodingApi = {
  geocoding: {
    forward(request: GeocodeRequest): Promise<GeocodeResult | null>
  }
}
