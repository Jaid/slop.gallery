import type {OrbFill, OrbGlassOptions, OrbRay} from '../base/OrbGlassMaterial.ts'
import type {Node} from 'three/webgpu'

import {Break, float, If, Loop, mix, mx_cell_noise_float, normalize, select, smoothstep, time, vec2, vec3} from 'three/tsl'

import {oilPaints} from '#src/lib/materials/oilPaints.ts'

import OrbGlassMaterial from '../base/OrbGlassMaterial.ts'
import {rgb, spinAroundY} from '../lib/fill.ts'
import {orbNoise} from '../lib/noise.ts'

/** the most steps the march takes through the fill */
const steps = 128
/** how far one step of the march goes at least and at most, in radii of the orb: far from any ribbon it strides, near one it closes in on its surface */
const stride = [0.003, 0.05] as const
/** how fast the {@link ribbonsAt} reach of ribbons at their full thickness falls at most, per radius of the orb, which a step’s length is reckoned by, so it doesn’t step through the ribbon ahead */
const steepest = 50
/** the paints, of which every ribbon is one or two: cadmium yellow, vermilion, ultramarine and viridian, and titanium white twice as often */
const paints = [oilPaints.cadmiumYellow, oilPaints.vermilion, oilPaints.titaniumWhite, oilPaints.ultramarine, oilPaints.viridian, oilPaints.titaniumWhite].map(rgb)
/** how many ribbons lie side by side per unit, across the spiral the stirring winds them into and up along it */
const spacing = [3.2, 3] as const
/** how far a ribbon reaches out of its middle across and along its flat side, in shares of its spacing */
const ribbonHalf = [0.15, 0.2] as const
/** how far out of every ribbon an empty place lies, as its {@link ribbonsAt} reach */
const emptyReach = 8
/** the farthest out of the ribbon in its own place a point can lie, as its {@link ribbonsAt} reach, unless it is nearer the glass, where ribbons thin out */
const cellReach = Math.hypot(0.5 / ribbonHalf[0], 0.5 / ribbonHalf[1])
/** how far apart the field is sampled to find which way a ribbon’s surface faces, in radii of the orb */
const normalStep = 0.006
/** where the light falls into the orb from, in its own frame: from above, a little from the front and the right */
const light = normalize(vec3(0.35, 1, 0.45))
/** One of the paints, picked by the ribbon’s place among them and `layer`, which tells apart picks for the same ribbon. */
function paintOf(cell: Node<'vec2'>, layer: number) {
  const index = mx_cell_noise_float(vec3(cell, layer)).mul(paints.length).floor()
  let paint: Node<'vec3'> = paints[0]
  for (const [order, color] of paints.entries()) {
    if (order) {
      paint = select(index.greaterThanEqual(order), color, paint)
    }
  }
  return paint
}
/**
 * Where a point of the fill lies among the ribbons: in which ribbon’s place (`cell`), where across its flat cross section (`offset`, the edge 1 from its middle) and how far out of it (`reach`, below 1 inside a ribbon), how thick the ribbons are there (`thickness`, 1 but toward the glass) and the currents bending them there (`warp`).
 * The oil turns slowly, faster toward the middle, so the ribbons wind into a spiral; currents fold them over, some places stay empty, and toward the glass every ribbon thins out to nothing, leaving clear oil next to it.
 */
function ribbonsAt(point: Node<'vec3'>) {
  const swirled = spinAroundY(point, time.mul(0.12).add(point.length().oneMinus().mul(3)))
  const flow = swirled.mul(1.2).add(vec3(0, time.mul(0.05), 0))
  const warp = orbNoise(flow.mul(0.55).add(vec3(time.mul(0.04), 0, 0)))
  const q = flow.add(warp.xyz.mul(0.5))
  const across = q.x.mul(0.7).add(q.y.mul(0.25)).add(warp.w.mul(0.25)).mul(spacing[0])
  const along = q.y.mul(0.9).add(q.z.mul(0.2)).add(orbNoise(q.mul(0.9).add(5.3)).x.mul(0.25)).mul(spacing[1])
  const cell = vec2(across.floor(), along.floor())
  const offset = vec2(across.fract().sub(0.5).div(ribbonHalf[0]), along.fract().sub(0.5).div(ribbonHalf[1]))
  const empty = select(mx_cell_noise_float(vec3(cell, 3.5)).lessThan(0.25), float(emptyReach), float(0))
  // Shrinking round its own middle rather than cut off, so a ribbon winding along the glass doesn’t come out shaved flat
  const thickness = smoothstep(0.97, 0.6, point.length()).max(0.05)
  return {
    cell,
    offset,
    reach: offset.length().div(thickness).add(empty),
    thickness,
    warp,
  }
}

/** Ribbons of oil paint curling through clear linseed oil, as if a brush had just stirred them, each squeezed out of its own tube of cadmium yellow, vermilion, titanium white, ultramarine or viridian, half of them streaked with a second paint: wound into a spiral that turns slowly, faster toward the middle, folded over by the currents, thinning out toward the glass and lit from above, glossy where they swell. */
export default class PaintsOrbMaterial extends OrbGlassMaterial {
  constructor(options: OrbGlassOptions) {
    super(options, {
      name: 'orb-paints',
      fillIor: 1.48,
      tint: '#f2e7c9',
    })
  }

  /** The paint is opaque, so the ray ends on the surface of the first ribbon it meets, found between the two steps of the march where it crossed into it, and shaded by which way that surface faces. */
  protected override fill(ray: OrbRay): OrbFill {
    const hit = float(0).toVar('paintHit')
    const depth = ray.jitter.mul(stride[0]).toVar('paintDepth')
    const previous = float(1e3).toVar('paintPrevious')
    const previousDepth = float(0).toVar('paintPreviousDepth')
    Loop({
      start: 0,
      end: steps,
      type: 'int',
    }, () => {
      If(depth.greaterThan(ray.length), () => {
        Break()
      })
      const {reach, thickness} = ribbonsAt(ray.origin.add(ray.direction.mul(depth)))
      If(reach.lessThan(1), () => {
        // How far back toward the last step the ray crossed into the ribbon, as if the field changed evenly in between, and out of a place of its own, where an empty place’s reach would put it too far forward
        const back = float(1).sub(reach).div(previous.min(cellReach).sub(reach).max(1e-4)).clamp(0, 1)
        depth.assign(depth.sub(back.mul(depth.sub(previousDepth))))
        hit.assign(1)
        Break()
      })
      previous.assign(reach)
      previousDepth.assign(depth)
      // The reach of thinner ribbons changes faster.
      depth.addAssign(reach.sub(1).mul(thickness).div(steepest).clamp(stride[0], stride[1]))
    })
    const point = ray.origin.add(ray.direction.mul(depth)).toVar('paintPoint')
    const {cell, offset, reach, warp} = ribbonsAt(point)
    const gradient = vec3(
      ribbonsAt(point.add(vec3(normalStep, 0, 0))).reach.sub(reach),
      ribbonsAt(point.add(vec3(0, normalStep, 0))).reach.sub(reach),
      ribbonsAt(point.add(vec3(0, 0, normalStep))).reach.sub(reach),
    ).normalize()
    // The paint’s surface ripples a little, pulled up into ridges as it was squeezed out.
    const normal = gradient.add(orbNoise(point.mul(9).add(cell.x.mul(1.3))).xyz.mul(0.18)).normalize().toVar('paintNormal')
    // Half the ribbons were squeezed out together with a second paint, which streaks along their flat side without mixing in.
    const streaked = mix(paintOf(cell, 0.5), paintOf(cell, 1.5), smoothstep(-0.12, 0.12, offset.y.add(warp.y.mul(0.8)).sub(0.25)))
    const paint = select(mx_cell_noise_float(vec3(cell, 2.5)).greaterThan(0.5), streaked, paintOf(cell, 0.5))
    const lit = normal.dot(light).max(0).mul(0.75).add(0.25).mul(smoothstep(-1, 1, point.y).mul(0.3).add(0.7))
    const gloss = normal.dot(light.sub(ray.direction).normalize()).max(0).pow(40).mul(0.5)
    // The oil in front of a ribbon dims it the deeper it lies.
    const depthShade = depth.mul(-0.35).exp()
    return {
      radiance: paint.mul(lit).mul(depthShade).add(vec3(gloss)).mul(hit),
      transmittance: hit.oneMinus(),
    }
  }
}
