import 'leaflet/dist/leaflet.css'

import * as React from 'react'
import { divIcon, type Marker as LeafletMarker } from 'leaflet'
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet'

type Coordinates = { readonly latitude: number; readonly longitude: number }

const customerLocationIcon = divIcon({
  className: 'customer-location-pin',
  html: '<svg aria-hidden="true" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg"><path d="M14 1.5C7.1 1.5 1.5 7.1 1.5 14c0 9.4 12.5 20.5 12.5 20.5S26.5 23.4 26.5 14C26.5 7.1 20.9 1.5 14 1.5Z" fill="var(--primary)" stroke="var(--primary-foreground)" stroke-width="1.5"/><circle cx="14" cy="14" r="4" fill="var(--primary-foreground)"/></svg>',
  iconAnchor: [14, 36],
  iconSize: [28, 36]
})

function LocationSelector({ onChange }: { readonly onChange: (value: Coordinates) => void }): null {
  useMapEvents({
    click(event) {
      onChange({ latitude: event.latlng.lat, longitude: event.latlng.lng })
    }
  })
  return null
}

function MapLocationUpdater({
  location,
  zoom,
  isVisible
}: {
  readonly location?: Coordinates
  readonly zoom: number
  readonly isVisible: boolean
}): null {
  const map = useMap()

  React.useEffect(() => {
    if (!isVisible || !location) return
    map.flyTo([location.latitude, location.longitude], zoom, { animate: true, duration: 0.6 })
  }, [isVisible, location?.latitude, location?.longitude, map, zoom])

  return null
}

function MapSizeUpdater({ isVisible }: { readonly isVisible: boolean }): null {
  const map = useMap()

  React.useEffect(() => {
    if (!isVisible) return
    const frame = requestAnimationFrame(() => map.invalidateSize({ pan: false }))
    return () => cancelAnimationFrame(frame)
  }, [isVisible, map])

  return null
}

export function AddressMapPicker({
  latitude,
  longitude,
  onChange,
  isVisible = true,
  zoom = 14,
  readOnly = false
}: {
  readonly latitude?: number
  readonly longitude?: number
  readonly onChange: (value: Coordinates) => void
  readonly isVisible?: boolean
  readonly zoom?: number
  readonly readOnly?: boolean
}): React.JSX.Element {
  const value: Coordinates | undefined =
    typeof latitude === 'number' &&
    typeof longitude === 'number' &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude)
      ? { latitude, longitude }
      : undefined
  const center: [number, number] = value ? [value.latitude, value.longitude] : [13.137, 123.679]
  return (
    <MapContainer center={center} zoom={14} className="h-64 rounded-md border" scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <MapSizeUpdater isVisible={isVisible} />
      <MapLocationUpdater location={value} zoom={zoom} isVisible={isVisible} />
      {!readOnly && <LocationSelector onChange={onChange} />}
      {value && (
        <Marker
          position={[value.latitude, value.longitude]}
          draggable={!readOnly}
          eventHandlers={
            readOnly
              ? undefined
              : {
                  dragend(event) {
                    const { lat, lng } = (event.target as LeafletMarker).getLatLng()
                    onChange({ latitude: lat, longitude: lng })
                  }
                }
          }
          icon={customerLocationIcon}
        />
      )}
    </MapContainer>
  )
}
