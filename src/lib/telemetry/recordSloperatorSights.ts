import type SlopGalleryTelemetry from './SlopGalleryTelemetry.ts'
import type {SloperatorStore} from './types.ts'

/** Round to millimeters, without negative zero. */
const round = (value: number) => Math.round(value * 1000) / 1000 || 0

/**
 * Logs `gallery.sloperator_sight` whenever the player catches sight of the Sloperator at one of his sights, as the store takes it down: once per sight, with the sight’s id, how he sat or stood, how far away he was and where the eye was.
 * Returns the unsubscription.
 */
export default function recordSloperatorSights(telemetry: SlopGalleryTelemetry, store: SloperatorStore) {
  return store.subscribe(({sighted}, previous) => {
    for (const sighting of sighted) {
      if (previous.sighted.includes(sighting)) {
        continue
      }
      const {distance, pose, position: [x, y, z], sight} = sighting
      telemetry.event('sloperator_sight', {
        'sight.id': sight,
        'sight.pose': pose,
        'sight.distance': round(distance),
        'position.x': round(x),
        'position.y': round(y),
        'position.z': round(z),
      }, `Caught sight of the Sloperator: ${sight}`)
    }
  })
}
