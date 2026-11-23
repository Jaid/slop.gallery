import type {ImpastoBubble, ImpastoStrokeShape} from '#src/orbs/impasto/strokes.ts'

import * as path from 'forward-slash-path'
import {Vector3} from 'three/webgpu'

import {impastoStrokeShapes, strokeDistance, strokeSurfaceDistance} from '#src/orbs/impasto/strokes.ts'

const help = `Usage: bun scripts/bakeImpastoOrb.ts

Bakes what the Impasto Orb’s glass would otherwise work out on every page load from its dollops in src/orbs/impasto/strokes.ts – each dollop’s bounding box and the air bubbles between them – and writes them to src/orbs/impasto/baked.ts. Run it again after changing the dollops.`
/** what each box reaches out past the paint found in it, in orb radii, so the march starts ahead of it */
const pad = 0.008
/** a dollop’s coordinates: `u` along its arc (−1 to 1 from heel to tip), `a` across it in its widths and `h` up from its shell in its reach of thickness and lift */
type Range = Record<'a' | 'h' | 'u', [number, number]>
/** where the coarse search looks for a dollop’s paint, well past where any of it can reach */
const searched: Range = {
  u: [-1.6, 1.6],
  a: [-2.5, 2.5],
  h: [-1.5, 2.5],
}
const coarseSteps = {
  u: 0.04,
  a: 0.05,
  h: 0.05,
}
// About ten times finer than the paint’s finest feature the old grid missed, a pulled tip a few hundredths of a radius across.
const fineSteps = {
  u: 0.01,
  a: 0.02,
  h: 0.02,
}
/** Finds the box round all of a dollop’s paint in its own frame: a coarse search narrows down where in its coordinates the paint lies, a fine one finds its extent there. */
export function bakeStrokeBox(shape: ImpastoStrokeShape) {
  const found: Range = {
    u: [Infinity, -Infinity],
    a: [Infinity, -Infinity],
    h: [Infinity, -Infinity],
  }
  sweep(shape, searched, coarseSteps, (u, a, h, _, point) => {
    // Generously near, since the field changes up to about 30 times faster than the distance it stands for.
    if (strokeDistance(point, shape) > 0.03) {
      return
    }
    for (const [key, value] of [['u', u], ['a', a], ['h', h]] as const) {
      found[key][0] = Math.min(found[key][0], value)
      found[key][1] = Math.max(found[key][1], value)
    }
  })
  for (const key of ['u', 'a', 'h'] as const) {
    if (found[key][0] <= searched[key][0] || found[key][1] >= searched[key][1]) {
      throw new Error(`The paint of a dollop reaches the edge of the search along ${key} (${found[key].join(' to ')}); search further.`)
    }
    found[key] = [found[key][0] - coarseSteps[key] * 2, found[key][1] + coarseSteps[key] * 2]
  }
  const box = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity]
  sweep(shape, found, fineSteps, (_u, _a, _h, local, point) => {
    if (strokeDistance(point, shape) >= strokeSurfaceDistance) {
      return
    }
    for (let axis = 0; axis < 3; axis++) {
      box[axis] = Math.min(box[axis], local[axis])
      box[axis + 3] = Math.max(box[axis + 3], local[axis])
    }
  })
  return [...box.slice(0, 3).map(value => Math.floor((value - pad) * 1e4) / 1e4), ...box.slice(3).map(value => Math.ceil((value + pad) * 1e4) / 1e4)] as [number, number, number, number, number, number]
}

/**
 * Places the air bubbles: 32 hero and medium ones scrambled across all latitudes by the golden ratio, then up to 48 fizzy micro-bubbles round them, each kept only where it clears the dollops, the other bubbles and the refracted silhouette (r × fillIor < 0.95).
 */
export function bakeBubbles(shapes: ReadonlyArray<ImpastoStrokeShape>) {
  const bubbles: Array<ImpastoBubble> = []
  const tryAdd = (center: Vector3, radius: number, strokePad: number, bubblePad: number) => {
    if (center.length() + radius >= 0.73) {
      return
    }
    if (!shapes.every(shape => strokeDistance(center, shape) > radius + strokePad)) {
      return
    }
    if (!bubbles.every(other => other.center.distanceTo(center) > radius + other.radius + bubblePad)) {
      return
    }
    bubbles.push({
      center,
      radius,
    })
  }
  for (let index = 0; index < 420 && bubbles.length < 32; index++) {
    const scrambledY = (index * 0.618034 % 1 * 2 - 1) * 0.94
    const angle = index * Math.PI * (3 - Math.sqrt(5)) + 0.35
    const radial = Math.sqrt(Math.max(0, 1 - scrambledY * scrambledY))
    const tier = index % 4
    const shell = tier === 0 ? 0.36 + index % 5 * 0.012 : (tier === 1 ? 0.54 + index % 6 * 0.026 : 0.64 + index % 5 * 0.016)
    const radius = index % 3 === 0 ? 0.024 + index % 4 * 0.004 : 0.015 + index * 7 % 10 / 10 * 0.008
    const center = new Vector3(radial * Math.cos(angle), scrambledY, radial * Math.sin(angle))
    center.multiplyScalar(shell)
    tryAdd(center, radius, 0.01, 0.01)
  }
  const heroCount = bubbles.length
  for (let index = 0; index < 480 && bubbles.length < 80; index++) {
    const host = bubbles[index % heroCount]
    const yaw = index * 2.399963 + 0.8
    const pitch = Math.sin(index * 1.73 + 0.5) * 1.1
    const distance = host.radius + 0.012 + index % 5 * 0.012
    const offset = new Vector3(Math.cos(pitch) * Math.cos(yaw), Math.sin(pitch), Math.cos(pitch) * Math.sin(yaw))
    offset.multiplyScalar(distance)
    tryAdd(host.center.clone().add(offset), 0.008 + index % 5 * 0.002, 0.008, 0.005)
  }
  return bubbles
}

/** Calls `visit` with the dollop’s frame coordinates of every point of a grid over `range` in its own coordinates, and the point itself. */
function sweep(shape: ImpastoStrokeShape, range: Range, steps: typeof coarseSteps, visit: (u: number, a: number, h: number, local: [number, number, number], point: Vector3) => void) {
  const reach = shape.thick * 2.3 + shape.lift
  const point = new Vector3
  for (let u = range.u[0]; u <= range.u[1] + 1e-9; u += steps.u) {
    const theta = u * shape.arc / shape.shell
    for (let a = range.a[0]; a <= range.a[1] + 1e-9; a += steps.a) {
      const phi = a * shape.width / shape.shell
      for (let h = range.h[0]; h <= range.h[1] + 1e-9; h += steps.h) {
        const radius = shape.shell + h * reach
        if (radius <= 0.02) {
          continue
        }
        const local: [number, number, number] = [radius * Math.cos(phi) * Math.sin(theta), radius * Math.sin(phi), radius * Math.cos(phi) * Math.cos(theta)]
        point.set(0, 0, 0).addScaledVector(shape.along, local[0]).addScaledVector(shape.across, local[1]).addScaledVector(shape.normal, local[2])
        visit(u, a, h, local, point)
      }
    }
  }
}
const main = () => {
  const boxes = impastoStrokeShapes.map(bakeStrokeBox)
  const bubbles = bakeBubbles(impastoStrokeShapes).map(({center, radius}) => [...center, radius].map(value => Math.round(value * 1e5) / 1e5))
  return `// Written by \`bun scripts/bakeImpastoOrb.ts\` from the dollops in \`strokes.ts\`; bake again after changing them.

/** each dollop’s bounding box in its own \`(along, across, normal)\` frame, in orb radii, padded so the march starts ahead of its paint: the lowest x, y and z, then the highest */
export const bakedStrokeBoxes: ReadonlyArray<readonly [number, number, number, number, number, number]> = [
${boxes.map(box => `  [${box.join(', ')}],`).join('\n')}
]

/** the air bubbles trapped between the dollops: center x, y and z, then radius, in orb radii */
export const bakedBubbles: ReadonlyArray<readonly [number, number, number, number]> = [
${bubbles.map(bubble => `  [${bubble.join(', ')}],`).join('\n')}
]
`
}

export default main

if (import.meta.main) {
  if (Bun.argv.includes('--help') || Bun.argv.includes('-h')) {
    console.log(help)
  } else {
    const file = path.resolve(import.meta.dir, '../src/orbs/impasto/baked.ts')
    await Bun.write(file, main())
    console.log(`Wrote ${file}`)
  }
}
