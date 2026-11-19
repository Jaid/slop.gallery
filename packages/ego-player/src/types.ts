import type {EgoDump} from './EgoDiagnostics.ts'
import type {RapierCollider, RapierRigidBody} from '@react-three/rapier'

export type EgoAction = 'backward' | 'crouch' | 'dump' | 'forward' | 'interact' | 'jump' | 'left' | 'modifier' | 'right' | 'sprint' | 'zoom'
/** Omitted actions are inactive. The reader may return a shared input object. */
export type EgoInput = Readonly<Partial<Record<EgoAction, boolean>>>
export type EgoInputReader = () => EgoInput
export type EgoToggle = (() => boolean) | boolean
export type EgoPosition = readonly [number, number, number]
export type EgoRotation = readonly [number, number, number, number]
export type EgoPoint = Readonly<{
  x: number
  y: number
  z: number
}>
export type EgoState = Readonly<{
  active: boolean
  crouching: boolean
  /** Free flight without gravity or collisions. */
  flying: boolean
  grounded: boolean
  /** World-space feet position. */
  position: EgoPoint
  /** Collision-resolved physical velocity, excluding camera motion. */
  velocity: EgoPoint
}>
/** First contact with an obstacle during one physics step. */
export type EgoImpact = Readonly<{
  /** whether the character was off the ground before the contact */
  airborne: boolean
  collider: RapierCollider
  /** World-space contact normal, pointing out of the obstacle toward the character. */
  normal: EgoPoint
  /** World-space contact point on the obstacle. */
  point: EgoPoint
  /** Collision-resolved speed toward the obstacle along the normal on the step before the contact. */
  speed: number
}>
export type EgoPlayerHandle = {
  readonly body: RapierRigidBody | null
  /** The same detached diagnostic snapshot the dump action produces, with the current input, or null before the body is ready. Works without `onDump`. */
  dump: () => EgoDump | null
  /** Flings the character off with a world-space velocity, replacing its momentum, like a blast or a springy obstacle. No-op before setup and while flying. */
  fling: (velocity: EgoPoint) => void
  /** A detached snapshot, or null before the body is ready. */
  getState: () => EgoState | null
  /** Restore zoom before another camera controller snapshots the current FOV. */
  releaseZoom: () => void
  /**
   * World-space feet position and optional camera quaternion. Resolves capsule clearance, unless flying, which goes anywhere, then resets momentum and jump history.
   * Returns where it put the feet, which is the fallback position where the capsule doesn’t fit the destination, or undefined before the body is ready, when the teleport waits for it.
   */
  teleport: (position: EgoPosition, rotation?: EgoRotation) => EgoPosition | undefined
}
