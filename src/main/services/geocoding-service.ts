import type { GeocodeRequest, GeocodeResult } from '../../shared/contracts'

export class GeocodingService {
  private readonly cache = new Map<string, GeocodeResult | null>()

  async forward(address: GeocodeRequest): Promise<GeocodeResult | null> {
    const key = [address.barangay, address.cityMunicipality, address.province, 'ph']
      .map((part) => part?.trim().toLocaleLowerCase() ?? '')
      .join('|')
    if (this.cache.has(key)) return this.cache.get(key) ?? null

    const queries = [
      [address.barangay, address.cityMunicipality, address.province, 'Philippines'],
      [address.cityMunicipality, address.province, 'Philippines'],
      [address.province, 'Philippines']
    ]
      .map((parts) => parts.filter(Boolean).join(', '))
      .filter((value, index, values) => values.indexOf(value) === index)

    for (const query of queries) {
      try {
        const params = new URLSearchParams({
          countrycodes: 'ph',
          format: 'jsonv2',
          limit: '1',
          q: query
        })
        const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
          headers: { 'User-Agent': 'Cashiers Report/1.0 (Electron desktop application)' }
        })
        if (!response.ok) continue
        const [result] = (await response.json()) as Array<{ lat?: string; lon?: string }>
        const latitude = Number.parseFloat(result?.lat ?? '')
        const longitude = Number.parseFloat(result?.lon ?? '')
        if (
          Number.isFinite(latitude) &&
          Number.isFinite(longitude) &&
          latitude >= -90 &&
          latitude <= 90 &&
          longitude >= -180 &&
          longitude <= 180
        ) {
          const location = { latitude, longitude }
          this.cache.set(key, location)
          return location
        }
      } catch {
        break
      }
    }

    this.cache.set(key, null)
    return null
  }
}
