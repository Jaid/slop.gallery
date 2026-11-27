import type {RigidBody, World} from '@dimforge/rapier3d-compat'

/**
 * How a ball resting on something slows down, which Rapier knows nothing of: its contact is a single point, so friction never slows a ball rolling on, nor one spinning in place like a top.
 * Rolling, it slows by `rolling` in m/s², about a tenth of a g, so a ball knocked at 2 m/s comes to rest within 2 m; spinning round where it touches, by `spinning` in radians per second squared, so an orb thrown on a sprint spins out within a few seconds.
 */
export const rollingResistance = {
  rolling: 1,
  spinning: 8,
}
/** how upright what holds a ball has to be to bear it, as the up part of the line from where it touches to its middle */
const bearing = 0.3

type Vector = {
  x: number
  y: number
  z: number
}
const dot = (a: Vector, b: Vector) => a.x * b.x + a.y * b.y + a.z * b.z
/** `vector` split into its part along `normal`, of unit length, and the rest */
const split = (vector: Vector, normal: Vector) => {
  const along = dot(vector, normal)
  return {
    along,
    across: {
      x: vector.x - normal.x * along,
      y: vector.y - normal.y * along,
      z: vector.z - normal.z * along,
    },
  }
}
/** `vector` shortened by `amount`, but never past nothing */
const shorten = (vector: Vector, amount: number) => {
  const length = Math.hypot(vector.x, vector.y, vector.z)
  const kept = length > amount ? (length - amount) / length : 0
  return {
    x: vector.x * kept,
    y: vector.y * kept,
    z: vector.z * kept,
  }
}
/**
 * Slows the ball of `body`, its first collider, by {@link rollingResistance} for `delta` seconds while something bears it, both its roll and its spin round where it touches, until it comes to rest. In flight, it leaves it alone.
 */
export function resistRolling(world: World, body: RigidBody, delta: number) {
  if (!body.isEnabled() || !body.isDynamic() || body.isSleeping() || !body.numColliders()) {
    return
  }
  const normal = support(world, body)
  if (!normal) {
    return
  }
  const radius = body.collider(0).radius()
  const spin = split(body.angvel(), normal)
  const motion = split(body.linvel(), normal)
  const slowedSpin = Math.sign(spin.along) * Math.max(0, Math.abs(spin.along) - rollingResistance.spinning * delta)
  const roll = shorten(spin.across, rollingResistance.rolling / radius * delta)
  const glide = shorten(motion.across, rollingResistance.rolling * delta)
  body.setAngvel({
    x: roll.x + normal.x * slowedSpin,
    y: roll.y + normal.y * slowedSpin,
    z: roll.z + normal.z * slowedSpin,
  }, false)
  body.setLinvel({
    x: glide.x + normal.x * motion.along,
    y: glide.y + normal.y * motion.along,
    z: glide.z + normal.z * motion.along,
  }, false)
}

/** Where the ball of `body` rests on something, the line from there to its middle, of unit length, or none while nothing bears it, like in flight or against a wall. */
function support(world: World, body: RigidBody) {
  const ball = body.collider(0)
  const center = body.translation()
  let best: Vector | undefined
  world.contactPairsWith(ball, other => {
    world.contactPair(ball, other, manifold => {
      for (let i = 0; i < manifold.numSolverContacts(); i++) {
        const point = manifold.solverContactPoint(i)
        if (!point) {
          continue
        }
        const x = center.x - point.x
        const y = center.y - point.y
        const z = center.z - point.z
        const length = Math.hypot(x, y, z)
        if (length > 1e-6 && y / length > bearing && (!best || y / length > best.y)) {
          best = {
            x: x / length,
            y: y / length,
            z: z / length,
          }
        }
      }
    })
  })
  return best
}
