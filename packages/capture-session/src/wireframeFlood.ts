import type {Vec3} from './types.ts'

export type WireframeFlood = {
  /** what point of a triangle decides when it flips, in triangle and combined mode: nearest flips it as soon as the sphere touches it, centroid once the sphere reaches its middle, farthest once the sphere encloses it */
  anchor: WireframeFloodAnchor
  /** percent of its line color a wireframe face shows when facing the camera; edge-on faces are black */
  angleIndicatorStrength: number
  /** draws the wireframe with 4× MSAA for smooth lines */
  antialiasing: boolean
  /** color behind the wireframe, where no surface is, as #rgb or #rrggbb; null leaves the renderer’s clear color */
  background: string | null
  /** how the speed starts out, as a multiple of it: above 1 the flood shoots out and slows down to its speed, below 1 it builds up to it */
  burst: number
  /** seconds over which the burst eases into the regular speed, as the time constant of an exponential */
  burstDuration: number
  /** line color of everything not highlighted, as #rgb or #rrggbb; null falls back to red beside highlights and white otherwise */
  color: string | null
  /** in turns everything the sphere reaches into wireframe; out starts from a frame that is all wireframe and turns everything the sphere reaches back into the scene */
  direction: WireframeFloodDirection
  /** whether the flood renders at all */
  enabled: boolean
  /** seconds a flipped triangle glows, starting in its full line color the moment it flips and fading with a steep exponential ease-out, in triangle and combined mode; 0 turns the triangle glow off */
  glowDuration: number
  /** mesh paths whose objects draw in blue while everything else draws in red; empty draws every line white */
  highlight: Array<string>
  /** line color of the highlighted objects, as #rgb or #rrggbb; null falls back to blue */
  highlightColor: string | null
  /** barycentric draws antialiased edges of line_width pixels as part of each face; lines draws 1 px hardware lines */
  lineStyle: WireframeLineStyle
  /** pixels a barycentric edge is wide */
  lineWidth: number
  /** triangle flips each triangle whole once the sphere reaches its anchor, with the seam glowing on whole triangles for a while after they flip; pixel flips every pixel by its own distance, with a soft edge and the seam along the sphere’s border; combined flips like triangle but glows both ways */
  mode: WireframeFloodMode
  position: Vec3
  /** meters; every surface closer to the position than this has flipped */
  radius: number
  /** glow color of the seam along the sphere’s border, as #rgb or #rrggbb; flipped triangles glow in their own line color; null falls back to #a8d4ff */
  seamColor: string | null
  /** peak brightness the seam adds; 0 turns it off */
  seamIntensity: number
  /** meters from the sphere’s border at which its seam glow falls to 1/e, in pixel and combined mode; null grows it with the radius, 0.06 + 0.12 per meter */
  seamWidth: number | null
  /** sphere floods in 3D; circle measures only horizontally, flooding as a vertical cylinder */
  shape: WireframeFloodShape
  /** meters per second the radius keeps growing by, without an end, from the moment it was set; null leaves the radius as set */
  speed: number | null
}

export const wireframeFloodModes = ['pixel', 'triangle', 'combined'] as const

export type WireframeFloodMode = typeof wireframeFloodModes[number]

export const wireframeFloodAnchors = ['nearest', 'centroid', 'farthest'] as const

export type WireframeFloodAnchor = typeof wireframeFloodAnchors[number]

export const wireframeFloodShapes = ['sphere', 'circle'] as const

export type WireframeFloodShape = typeof wireframeFloodShapes[number]

export const wireframeFloodDirections = ['in', 'out'] as const

export type WireframeFloodDirection = typeof wireframeFloodDirections[number]

export const wireframeLineStyles = ['barycentric', 'lines'] as const

export type WireframeLineStyle = typeof wireframeLineStyles[number]

/** The live flood every gallery pipeline renders, set through the `set_wireframe` WebMCP tool. The wireframe passes only run while it is enabled, and flooding in, with a radius above 0. */
export const wireframeFlood: WireframeFlood = {
  background: null,
  burst: 1,
  burstDuration: 0.5,
  anchor: 'nearest',
  antialiasing: false,
  angleIndicatorStrength: 0,
  color: null,
  direction: 'in',
  enabled: false,
  highlight: [],
  highlightColor: null,
  lineStyle: 'barycentric',
  lineWidth: 0.5,
  mode: 'triangle',
  position: [0, 0, 0],
  radius: 0,
  seamColor: null,
  speed: null,
  shape: 'sphere',
  glowDuration: 1,
  seamIntensity: 0.9,
  seamWidth: null,
}

type MotionKey = 'burst' | 'burstDuration' | 'direction' | 'radius' | 'speed'

const motionKeys = new Set<keyof WireframeFlood>(['burst', 'burstDuration', 'direction', 'radius', 'speed'])
// The radius grows from where it was when any motion field last changed. Fields sent again unchanged, like a film resending its whole state every frame, keep the flood going.
const commanded: Partial<Record<MotionKey, unknown>> = {}
let launch = {
  radius: wireframeFlood.radius,
  time: 0,
}

/** Applies changes to the live flood, skipping undefined ones, and returns a copy of the flood now in effect. A new direction, even the one in effect when sent for the first time, turns the flood on unless enabled says otherwise and starts it over from the radius it comes with, or from 0. */
export function applyWireframeFlood(changes: Partial<WireframeFlood>, now = performance.now() / 1000) {
  let relaunch = false
  let restart = false
  for (const [key, value] of Object.entries(changes) as Array<[keyof WireframeFlood, unknown]>) {
    if (value === undefined) {
      continue
    }
    if (motionKeys.has(key)) {
      if (commanded[key as MotionKey] === value) {
        continue
      }
      commanded[key as MotionKey] = value
      relaunch = true
      restart ||= key === 'direction'
    }
    Object.assign(wireframeFlood, {[key]: value})
  }
  if (restart) {
    wireframeFlood.radius = changes.radius ?? 0
    commanded.radius = wireframeFlood.radius
    wireframeFlood.enabled = changes.enabled ?? true
  }
  if (relaunch) {
    launch = {
      radius: wireframeFlood.radius,
      time: now,
    }
  }
  return structuredClone(wireframeFlood)
}

/** Grows the radius by the speed, with the burst easing into it: the growth rate starts at speed × burst and approaches the speed exponentially. */
export function advanceWireframeFlood(now = performance.now() / 1000) {
  const {burst, burstDuration, speed} = wireframeFlood
  if (speed === null) {
    return
  }
  const elapsed = Math.max(0, now - launch.time)
  wireframeFlood.radius = launch.radius + speed * (elapsed + (burst - 1) * burstDuration * (1 - Math.exp(-elapsed / burstDuration)))
}
