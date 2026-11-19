import {BufferGeometry, Float32BufferAttribute} from 'three/webgpu'

export type ForgeCeilingPlan = {
  crownY: number
  openingRadius: number
  /** round half-plan, when the room is circular */
  radius?: number
  segments?: number
  /** rectangular half-plan, in x and z */
  size?: readonly [width: number, depth: number]
  springY: number
}

/** Where a ray from the middle hits the outside of a rectangular or round plan. */
export function forgeCeilingOutline(plan: ForgeCeilingPlan, angle: number) {
  const xDirection = Math.cos(angle)
  const zDirection = Math.sin(angle)
  if (plan.radius !== undefined) {
    return [xDirection * plan.radius, zDirection * plan.radius] as const
  }
  const [width, depth] = plan.size!
  const distance = Math.min(
    xDirection === 0 ? Infinity : width / 2 / Math.abs(xDirection),
    zDirection === 0 ? Infinity : depth / 2 / Math.abs(zDirection),
  )
  return [xDirection * distance, zDirection * distance] as const
}

/**
 * The Forge’s hipped ceiling: a watertight ring of sloping copper-iron sails between the room’s walls and its round skylight. Every outer vertex lies exactly on the room boundary; the corner angles are included so the last slivers cannot leave a gap to the walls.
 */
export function forgeCeilingGeometry(plan: ForgeCeilingPlan) {
  const segments = plan.segments ?? 96
  const angles = new Set(Array.from({length: segments}, (_, index) => index / segments * Math.PI * 2))
  if (plan.radius === undefined && plan.size) {
    const [width, depth] = plan.size
    for (const x of [-1, 1]) {
      for (const z of [-1, 1]) {
        angles.add((Math.atan2(z * depth / 2, x * width / 2) + Math.PI * 2) % (Math.PI * 2))
      }
    }
  }
  const sorted = [...angles].toSorted((a, b) => a - b)
  const positions: Array<number> = []
  const indices: Array<number> = []
  for (const angle of sorted) {
    const [outerX, outerZ] = forgeCeilingOutline(plan, angle)
    positions.push(
      Math.cos(angle) * plan.openingRadius,
      plan.crownY,
      Math.sin(angle) * plan.openingRadius,
      outerX,
      plan.springY,
      outerZ,
    )
  }
  const count = sorted.length
  for (let index = 0; index < count; index++) {
    const next = (index + 1) % count
    const inner = index * 2
    const outer = inner + 1
    const nextInner = next * 2
    const nextOuter = nextInner + 1
    // Winding faces down into the room, so the visible roof surface receives shadow and light from below.
    indices.push(inner, outer, nextOuter, inner, nextOuter, nextInner)
  }
  const geometry = new BufferGeometry
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

