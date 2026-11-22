import type {Wall} from '#src/lib/placement/wallGeometry.ts'

import {wallFace} from '#src/lib/gallery/architectureDimensions.ts'

import {sandboxBaseboardHeight} from '../lib/sandboxFinish.ts'

type Point = readonly [front: number, y: number]

/** how far the plinth’s face stands out of the wall’s, and how high it rises */
const plinth = {
  front: 0.03,
  top: 0.118,
}
/** the shadow line cut in over the plinth, under the bead */
const groove = {
  depth: 0.008,
  height: 0.006,
}
/** the round bead over the groove, standing out a little further than the plinth */
const beadRadius = 0.013
/** the narrow step between the bead and the cap, back toward the wall */
const fillet = {
  depth: 0.006,
  height: 0.004,
}
const steps = 10
/** Points from `[front, y]` round a half circle bulging out from the wall, `radius` meters, ending right above where they started. */
const bead = ([front, y]: Point, radius: number): Array<Point> => Array.from({length: steps * 2}, (_, index) => {
  const angle = -Math.PI / 2 + Math.PI * (index + 1) / (steps * 2)
  // Its last point lies right above its first, where the section steps on from it.
  return index === steps * 2 - 1 ? [front, y + radius * 2] as const : [front + Math.cos(angle) * radius, y + radius + Math.sin(angle) * radius] as const
})
/** Points from `[front, y]` up an ogee into the wall’s face: bulging out below and hollow above, `height` meters high. */
const ogee = ([front, y]: Point, height: number): Array<Point> => Array.from({length: steps * 2}, (_, index) => {
  const t = (index + 1) / (steps * 2)
  const s = t * t * (3 - 2 * t)
  // Its last point lies on the wall’s face exactly, where the section has to end.
  return [t === 1 ? wallFace : front - (front - wallFace) * s, y + height * t] as const
})
const toe = wallFace + plinth.front
const grooveFront = toe - groove.depth
const beadTop = plinth.top + groove.height + beadRadius * 2
const capFront = grooveFront - fillet.depth
const capBottom = beadTop + fillet.height
/** how high the cap’s ogee rises, from the fillet back into the wall’s face, where the whole baseboard ends as high as the hall’s, {@link sandboxBaseboardHeight} */
const capHeight = sandboxBaseboardHeight - capBottom
/**
 * The baseboard of the Cell’s round spaces in the Arena’s black lacquer, low and finely molded instead of the two tall plain bands: a slim plinth with its toe on the floor, a shadow line cut in over it, a round bead catching the light, a narrow fillet and an ogee cap curving back into the velvet.
 * It stands {@link sandboxBaseboardHeight} high and less than 4 cm out of the wall’s face.
 */
const cellBaseboard: NonNullable<Wall['baseboardSection']> = [
  [toe, 0],
  [toe, plinth.top],
  [grooveFront, plinth.top],
  [grooveFront, plinth.top + groove.height],
  ...bead([grooveFront, plinth.top + groove.height], beadRadius),
  [capFront, beadTop],
  [capFront, capBottom],
  ...ogee([capFront, capBottom], capHeight),
]

export default cellBaseboard
