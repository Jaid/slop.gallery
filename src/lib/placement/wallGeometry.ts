import type {Portrait, Vec3} from '../gallery/types.ts'

import portraitLabel, {portraitLabelLayout} from '../gallery/portraitLabel.ts'

/** how far away, in meters along the aim ray, an artwork can still be hung */
export const placementReach = 10
/** distance between a wall plane and the center of an artwork hanging on it */
export const hangingOffset = 0.22

/** how close, in meters, the space a work takes up on its wall, placard and breathing space included, may come to the wall’s ends, its foot, its top and its openings and reservations */
export const hangingMargins = {
  side: 0.24,
  bottom: 0.48,
  top: 0.55,
  cutout: 0.14,
} as const

/** Reasons why an artwork cannot hang at a spot. */
export const placementIssues = {
  unsticky: 'unsticky',
  frame: 'frame',
  doorway: 'doorway',
  neighbor: 'neighbor',
  reach: 'reach',
  window: 'window',
  lightSwitch: 'lightSwitch',
} as const

export type PlacementIssue = typeof placementIssues[keyof typeof placementIssues]

export type WallOpening = {
  bottom?: number
  /** whether a trimmed wall frames it with a casing, true by default; a bare opening, like a vault’s mouth, cuts through the wall’s cornice too instead of passing under it */
  casing?: boolean
  glassThickness?: number
  height: number
  /** the hole’s name within its wall, in snake_case, which openings between rooms refer to it by */
  name?: string
  /** a rectangle, an arch springing from its jambs or a round hole, as wide as it is high from its `bottom` to its `height` */
  profile: 'arch' | 'rectangle' | 'round'
  /** how far an arch rises over the height where it springs from its jambs: half its width, a semicircle, unless it is a flatter segmental arch */
  rise?: number
  u: number
  width: number
}

/** a solid feature on a wall that artworks must keep clear of, like an entrance surround or a panel of buttons */
export type WallReservation = WallOpening & {
  /** why an artwork cannot overlap it; defaults to the doorway reason */
  reason?: PlacementIssue
}

export type Wall = {
  /** Height of the projecting upper cap of the default two-band baseboard, 4 cm unless specified. */
  baseboardCapHeight?: number
  /** how high the default baseboard’s two plain bands reach, 0.25 m unless the wall says otherwise; a {@link baseboardSection} sets its own */
  baseboardHeight?: number
  /** How far the baseboard’s ends slant back where they differ from `miters`: square where the other wall of the corner is opened down to the floor right at it, so this baseboard runs on into whatever continues past the opening. */
  baseboardMiters?: readonly [number, number]
  /** Floor contact in local coordinates; repeated u coordinates split the trim at a vertical jump. */
  baseboardProfile?: Array<readonly [number, number]>
  /** a molded baseboard instead of the two plain bands: its cross-section as points of how far it stands out of the wall’s center line at which height over the floor, from its toe on the floor up to where its top meets the wall’s face; only along a level floor, without a {@link baseboardProfile} */
  baseboardSection?: ReadonlyArray<readonly [front: number, y: number]>
  center: Vec3
  /** whether the wall carries a cornice along its top when trimmed, true by default */
  cornice?: boolean
  /** Signed bend radius, measured from the untrimmed wall plane. */
  curveRadius?: number
  height: number
  holes?: Array<WallOpening>
  id: string
  /** How far the trim’s ends at the wall’s −x and +x ends slant back along the wall per meter they stand out of its plane, to meet another wall’s in an inside corner: 1 at a right angle and less at a wider one, 0 for a square end. */
  miters?: readonly [number, number]
  /** Solid architectural features which must remain free of hanging artwork. */
  reservations?: Array<WallReservation>
  /** the id of the room the wall belongs to */
  room: string
  rotation: number
  slope?: number
  /** whether artworks can be hung on it, true by default */
  sticky?: boolean
  trimStyle?: 'classic' | 'none' | 'plain'
  width: number
}

/** The circle an arched opening’s top follows, through its crown and the points where it springs from its jambs: its radius and its center’s height over the wall’s foot. */
export function openingArc(hole: WallOpening) {
  const rise = hole.rise ?? hole.width / 2
  const radius = ((hole.width / 2) ** 2 + rise ** 2) / (2 * rise)
  return {
    radius,
    center: hole.height - radius,
  }
}

/** The circle a round opening follows: its radius and its center’s height over the wall’s foot. */
export function openingCircle(hole: WallOpening) {
  if (hole.profile !== 'round' || Math.abs(hole.height - (hole.bottom ?? 0) - hole.width) > 1e-9) {
    throw new RangeError('Only a round opening, as high as it is wide, has a circle.')
  }
  return {
    radius: hole.width / 2,
    center: (hole.bottom ?? 0) + hole.width / 2,
  }
}

// This profile is shared by CSG cutters, portal trim and interaction ray tests.
/** The height of the opening’s top over the wall’s foot at `u` along the wall, `padding` meters further out around it, like its casing; -Infinity beside it. */
export function openingTop(hole: WallOpening, u: number, padding = 0) {
  const halfWidth = hole.width / 2 + padding
  const x = Math.abs(u - hole.u)
  if (x > halfWidth) {
    return -Infinity
  }
  if (hole.profile === 'rectangle') {
    return hole.height + padding
  }
  const {radius, center} = hole.profile === 'round' ? openingCircle(hole) : openingArc(hole)
  return center + Math.sqrt(Math.max(0, (radius + padding) ** 2 - x ** 2))
}

/** The height of the opening’s bottom over the wall’s foot at `u` along the wall: its sill, or for a round opening, its circle’s lower half there. */
export function openingBottom(hole: WallOpening, u: number) {
  if (hole.profile !== 'round') {
    return hole.bottom ?? 0
  }
  const {radius, center} = openingCircle(hole)
  return center - Math.sqrt(Math.max(0, radius ** 2 - (u - hole.u) ** 2))
}

export function insideOpening(hole: WallOpening, u: number, y: number) {
  return y >= openingBottom(hole, u) && y < openingTop(hole, u)
}

/** The world position `offset` meters in front of a wall, at wall coordinate `u` and height `y`. */
export function wallPosition(targetWall: Wall, u: number, y: number, offset = hangingOffset): Vec3 {
  const sin = Math.sin(targetWall.rotation)
  const cos = Math.cos(targetWall.rotation)
  const radius = targetWall.curveRadius
  const x = radius ? (radius - offset) * Math.sin(u / radius) : u
  const z = radius ? radius - (radius - offset) * Math.cos(u / radius) : offset
  return [targetWall.center[0] + x * cos + z * sin, y, targetWall.center[2] - x * sin + z * cos]
}

/** The coordinate along a wall, measured from its center, of the point on it nearest to a position. */
export function wallCoordinates(targetWall: Pick<Wall, 'center' | 'curveRadius' | 'rotation'>, [x, , z]: Vec3) {
  const u = (x - targetWall.center[0]) * Math.cos(targetWall.rotation) - (z - targetWall.center[2]) * Math.sin(targetWall.rotation)
  if (targetWall.curveRadius) {
    const depth = (x - targetWall.center[0]) * Math.sin(targetWall.rotation) + (z - targetWall.center[2]) * Math.cos(targetWall.rotation)
    return Math.atan2(u / targetWall.curveRadius, 1 - depth / targetWall.curveRadius) * targetWall.curveRadius
  }
  return u
}

/** How far a position lies in front of a wall, out into its room, like the `offset` of {@link wallPosition}; negative behind it. */
export function wallOffset(targetWall: Pick<Wall, 'center' | 'curveRadius' | 'rotation'>, [x, , z]: Vec3) {
  const sin = Math.sin(targetWall.rotation)
  const cos = Math.cos(targetWall.rotation)
  const along = (x - targetWall.center[0]) * cos - (z - targetWall.center[2]) * sin
  const depth = (x - targetWall.center[0]) * sin + (z - targetWall.center[2]) * cos
  const radius = targetWall.curveRadius
  if (!radius) {
    return depth
  }
  return radius - Math.sign(radius) * Math.hypot(along, depth - radius)
}

/** Whether the stretch of a wall within `halfWidth` of `u` along it, from the world heights `bottom` to `top`, comes closer than {@link hangingMargins} to one of its openings or reservations, taken as the rectangle round it. */
export function nearCutout(targetWall: Wall, cutout: WallOpening, u: number, halfWidth: number, bottom: number, top: number) {
  return Math.abs(u - cutout.u) < halfWidth + cutout.width / 2 + hangingMargins.cutout && bottom < targetWall.center[1] + cutout.height + hangingMargins.cutout && top > targetWall.center[1] + (cutout.bottom ?? 0) - hangingMargins.cutout
}

/** Why an artwork of this size, centered at `position`, would cover an opening or a reservation of its wall, or an empty string if it covers neither. */
export function obstructionIssue(targetWall: Wall, position: Vec3, width: number, height: number, labelAbove = false) {
  const {u, halfWidth, bottom, top} = footprint(targetWall, position, width, height, labelAbove)
  const overlaps = (cutout: WallOpening) => nearCutout(targetWall, cutout, u, halfWidth, bottom, top)
  if (targetWall.holes?.some(overlaps)) {
    return placementIssues.doorway
  }
  const reservation = targetWall.reservations?.find(overlaps)
  if (reservation) {
    return reservation.reason ?? placementIssues.doorway
  }
  return ''
}

/** Why an artwork of this size cannot hang centered at `position` on a wall, or an empty string if it can. */
export function placementIssue(targetWall: Wall, position: Vec3, width: number, height: number, portraits: ReadonlyArray<Portrait>, ignoreId = '', labelAbove = false) {
  if (targetWall.sticky === false) {
    return placementIssues.unsticky
  }
  const {u, halfWidth, bottom, top} = footprint(targetWall, position, width, height, labelAbove)
  if (Math.abs(u) + halfWidth > targetWall.width / 2 - hangingMargins.side || bottom < targetWall.center[1] + hangingMargins.bottom || top > targetWall.center[1] + targetWall.height - hangingMargins.top) {
    return placementIssues.frame
  }
  const obstruction = obstructionIssue(targetWall, position, width, height, labelAbove)
  if (obstruction) {
    return obstruction
  }
  if (portraits.some(p => p.id !== ignoreId && p.hung && p.wallId === targetWall.id && Math.abs(wallCoordinates(targetWall, p.position) - u) < halfWidth + p.width / 2 + 0.18 && overlapsVertically(p, bottom, top))) {
    return placementIssues.neighbor
  }
  return ''
}

/** Distance along a ray, in multiples of its direction, to the front face of a wall, or `Infinity` if it misses or hits the back. */
export function wallRayDistance(targetWall: Wall, origin: Vec3, direction: Vec3) {
  const sin = Math.sin(targetWall.rotation)
  const cos = Math.cos(targetWall.rotation)
  const facing = direction[0] * sin + direction[2] * cos
  if (!targetWall.curveRadius) {
    return facing < -0.0001 ? ((targetWall.center[0] - origin[0]) * sin + (targetWall.center[2] - origin[2]) * cos) / facing : Infinity
  }
  const radius = targetWall.curveRadius
  const x = (origin[0] - targetWall.center[0]) * cos - (origin[2] - targetWall.center[2]) * sin
  const z = (origin[0] - targetWall.center[0]) * sin + (origin[2] - targetWall.center[2]) * cos - radius
  const dx = direction[0] * cos - direction[2] * sin
  const dz = facing
  const a = dx * dx + dz * dz
  const b = 2 * (x * dx + z * dz)
  const c = x * x + z * z - radius * radius
  const discriminant = b * b - 4 * a * c
  if (a < 1e-12 || discriminant < 0) {
    return Infinity
  }
  for (const distance of [(-b - Math.sqrt(discriminant)) / (2 * a), (-b + Math.sqrt(discriminant)) / (2 * a)]) {
    const angle = Math.atan2((x + dx * distance) / radius, -(z + dz * distance) / radius)
    if (distance >= 0 && Math.abs(angle * radius) <= targetWall.width / 2 + 1e-9 && -dx * Math.sin(angle) + dz * Math.cos(angle) < -0.0001) {
      return distance
    }
  }
  return Infinity
}

/** Whether a footprint from `bottom` to `top` comes too close above or below a hung work, its placard included. */
function overlapsVertically(p: Portrait, bottom: number, top: number) {
  const label = portraitLabelLayout(p.width, p.height, p.labelAbove)
  const lowest = p.position[1] + (p.labelAbove ? -p.height / 2 : label.bottom)
  const highest = p.position[1] + (p.labelAbove ? label.top : p.height / 2)
  return top > lowest - (p.labelAbove ? 0.23 : portraitLabel.neighborClearance) && bottom < highest + (p.labelAbove ? portraitLabel.neighborClearance : 0.23)
}
/** The space an artwork of this size, centered at `position`, takes up on a wall, including its frame, its label and a little breathing space. */
function footprint(targetWall: Wall, position: Vec3, width: number, height: number, labelAbove = false) {
  const label = portraitLabelLayout(width, height, labelAbove)
  return {
    u: wallCoordinates(targetWall, position),
    halfWidth: Math.max(width / 2 + 0.16, label.width / 2),
    bottom: labelAbove ? position[1] - height / 2 - 0.16 : position[1] + label.bottom - portraitLabel.clearance,
    top: labelAbove ? position[1] + label.top + portraitLabel.clearance : position[1] + height / 2 + 0.16,
  }
}
