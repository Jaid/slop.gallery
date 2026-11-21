import lowerGallery, {oculusPlatform} from './lowerGallery.ts'

/** a circular arc of the apse’s outline, around `center` from the polar angle `from` to `to`, which grow from the west over the north to the east */
export type ApseArc = {
  center: Point
  from: number
  radius: number
  to: number
}
type Point = readonly [x: number, z: number]

const {oculus} = lowerGallery
const [centerX, centerZ] = oculus.center
const halfWidth = oculus.size[0] / 2
/** where the side walls end and the apse begins, the north side of the Oculus’ rectangle */
const northZ = centerZ - oculus.size[1] / 2
/** how far the apse reaches north past the side walls’ ends, along its middle */
const depth = 5
/** the arcs that turn out of the side walls, tangent to them, wide enough to round off half of each side of the apse */
const shoulderRadius = 4.5
// A basket arch: the crown’s arc is tangent to both shoulders and spans the rest of the depth.
const crownRadius = ((halfWidth - shoulderRadius) ** 2 + depth ** 2 - shoulderRadius ** 2) / (2 * (depth - shoulderRadius))
const crownCenter: Point = [centerX, northZ - depth + crownRadius]
/** half the angle the crown spans, from the north to where it meets a shoulder, on the line through both centers */
const crownHalfAngle = Math.asin((halfWidth - shoulderRadius) / (crownRadius - shoulderRadius))
const north = Math.PI * 3 / 2
/** The Oculus’ round north end: a basket arch from the ends of its side walls, turning out of them tangentially and reaching `depth` meters north along its middle. Its outline runs along the walls’ center line. */
const oculusApse = {
  depth,
  northZ,
  shoulderRadius,
  crownRadius,
  crownCenter,
  /** from west to east: the west shoulder, the crown and the east shoulder */
  arcs: [
    {
      center: [centerX - halfWidth + shoulderRadius, northZ],
      radius: shoulderRadius,
      from: Math.PI,
      to: north - crownHalfAngle,
    },
    {
      center: crownCenter,
      radius: crownRadius,
      from: north - crownHalfAngle,
      to: north + crownHalfAngle,
    },
    {
      center: [centerX + halfWidth - shoulderRadius, northZ],
      radius: shoulderRadius,
      from: north + crownHalfAngle,
      to: Math.PI * 2,
    },
  ] as ReadonlyArray<ApseArc>,
}

/** The apse’s arcs `offset` meters further out, around the same centers. */
export function apseArcs(offset = 0): Array<ApseArc> {
  return oculusApse.arcs.map(arc => ({
    ...arc,
    radius: arc.radius + offset,
  }))
}

/** Points along the apse’s outline `offset` meters further out, from the west side wall’s line to the east one’s, each arc cut into steps of at most `step` radians. */
export function apseOutline(offset = 0, step = 1 / 16): Array<Point> {
  const points: Array<Point> = []
  for (const {center, radius, from, to} of apseArcs(offset)) {
    const steps = Math.max(1, Math.ceil((to - from) / step))
    for (let i = points.length ? 1 : 0; i <= steps; i++) {
      const angle = from + (to - from) * i / steps
      points.push([center[0] + Math.cos(angle) * radius, center[1] + Math.sin(angle) * radius])
    }
  }
  return points
}

/** How far north the apse’s outline `offset` meters further out reaches at `x`, or undefined beyond its sides. */
export function apseBoundaryZ(x: number, offset = 0) {
  const arcs = apseArcs(offset)
  const arc = arcs.find(({center, radius, to}) => x <= center[0] + Math.cos(to) * radius + 1e-9) ?? arcs.at(-1)!
  const across = x - arc.center[0]
  if (Math.abs(across) > arc.radius + 1e-9) {
    return
  }
  return arc.center[1] - Math.sqrt(Math.max(0, arc.radius ** 2 - across ** 2))
}

/** Whether the point lies in the apse, north of the side walls’ ends and inside its outline `offset` meters further out. */
export function insideApse(x: number, z: number, offset = 0) {
  const boundary = apseBoundaryZ(x, offset)
  return boundary !== undefined && z >= boundary && z <= northZ
}

/** The height of the platform’s top under the point: along the side walls’ north ends and in the apse behind them, out to the walls’ center lines. */
export function platformFloorHeight(x: number, z: number) {
  const {position, size} = oculusPlatform
  if (Math.abs(x - position[0]) <= size[0] / 2 && Math.abs(z - position[2]) <= size[2] / 2 || insideApse(x, z)) {
    return position[1] + size[1] / 2
  }
}

export default oculusApse
