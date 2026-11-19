import type SlopGalleryTelemetry from './SlopGalleryTelemetry.ts'
import type {GeofenceStore} from './types.ts'

/** Round to millimeters, or millimeters per second, without negative zero. */
const round = (value: number) => Math.round(value * 1000) / 1000 || 0

/**
 * Logs `gallery.geofence.entered` and `gallery.geofence.left` whenever the player’s place enters or leaves any of the fences the store follows it through, each fence on its own, first those left, then those entered, so overlapping fences all count and a passage between two rooms leaves the one before entering the next. Each carries the position and the velocity the fence was crossed at, which tells the direction the player came from or went off to.
 * The fences the player starts in count silently, so only actually moving across a fence does. `title` names a fence in the log message, like a room by its title, falling back to its id. Returns the unsubscription.
 */
export default function recordGeofenceCrossings(telemetry: SlopGalleryTelemetry, store: GeofenceStore, title: (id: string) => string | undefined = () => {}) {
  return store.subscribe(({crossing, fences}, previous) => {
    if (!crossing) {
      return
    }
    const {position: [x, y, z], velocity: [velocityX, velocityY, velocityZ]} = crossing
    const record = (event: 'entered' | 'left', id: string) => {
      telemetry.event(`geofence.${event}`, {
        'geofence.id': id,
        'position.x': round(x),
        'position.y': round(y),
        'position.z': round(z),
        'velocity.x': round(velocityX),
        'velocity.y': round(velocityY),
        'velocity.z': round(velocityZ),
      }, `${event === 'entered' ? 'Entered' : 'Left'} geofence: ${title(id) ?? id}`)
    }
    for (const id of previous.fences) {
      if (!fences.includes(id)) {
        record('left', id)
      }
    }
    for (const id of fences) {
      if (!previous.fences.includes(id)) {
        record('entered', id)
      }
    }
  })
}
