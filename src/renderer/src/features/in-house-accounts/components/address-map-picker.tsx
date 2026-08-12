import 'leaflet/dist/leaflet.css'

import { CircleMarker, MapContainer, TileLayer, useMapEvents } from 'react-leaflet'

type Coordinates = { readonly latitude: number; readonly longitude: number }

function LocationSelector({ value, onChange }: { readonly value?: Coordinates; readonly onChange: (value: Coordinates) => void }): null {
  useMapEvents({
    click(event) {
      onChange({ latitude: event.latlng.lat, longitude: event.latlng.lng })
    }
  })
  return null
}

export function AddressMapPicker({ latitude, longitude, onChange }: { readonly latitude?: number; readonly longitude?: number; readonly onChange: (value: Coordinates) => void }): React.JSX.Element {
  const value = latitude !== undefined && longitude !== undefined ? { latitude, longitude } : undefined
  const center: [number, number] = value ? [value.latitude, value.longitude] : [13.137, 123.679]
  return (
    <MapContainer center={center} zoom={14} className="h-64 rounded-md border" scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <LocationSelector value={value} onChange={onChange} />
      {value && <CircleMarker center={[value.latitude, value.longitude]} radius={8} pathOptions={{ color: 'hsl(var(--primary))' }} />}
    </MapContainer>
  )
}
