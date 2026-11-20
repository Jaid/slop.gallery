import type SlopGalleryTelemetry from './SlopGalleryTelemetry.ts'
import type {SloperatorStore} from './types.ts'

/** Round to millimeters, or milliradians, without negative zero. */
const round = (value: number) => Math.round(value * 1000) / 1000 || 0

/**
 * Logs `gallery.sloperator_spawn` whenever the player enters the fence of one of the Sloperator’s sights and the physics finds whether he turns up there, as the store takes it down: once per entering, with the sight’s id, the `spawn.result` and how the physics found his seat, `spawn.furniture_detection`, `none` at a sight without one. Where he turns up, it also tells how he sits or stands, `spawn.pose`, and where: the point on the floor under him, `spawn.x`, `spawn.y` and `spawn.z`, and his turn around y, `spawn.yaw`, between −π and π.
 * Returns the unsubscription.
 */
export default function recordSloperatorSpawns(telemetry: SlopGalleryTelemetry, store: SloperatorStore) {
  return store.subscribe(({spawns}, previous) => {
    for (const [sight, spawn] of Object.entries(spawns)) {
      if (!spawn || previous.spawns[sight] === spawn) {
        continue
      }
      const {detection, placement, result} = spawn
      if (!placement) {
        telemetry.event('sloperator_spawn', {
          'sight.id': sight,
          'spawn.result': result,
          'spawn.furniture_detection': detection,
        }, `Kept the Sloperator away from ${sight}: ${detection}`)
        continue
      }
      const {pose, position: [x, y, z], yaw} = placement
      telemetry.event('sloperator_spawn', {
        'sight.id': sight,
        'spawn.result': result,
        'spawn.furniture_detection': detection,
        'spawn.pose': pose,
        'spawn.x': round(x),
        'spawn.y': round(y),
        'spawn.z': round(z),
        'spawn.yaw': round(Math.atan2(Math.sin(yaw), Math.cos(yaw))),
      }, detection === 'none' ? `Spawned the Sloperator at ${sight}: ${pose}` : `Spawned the Sloperator at ${sight}: ${pose}, his seat ${detection}`)
    }
  })
}
