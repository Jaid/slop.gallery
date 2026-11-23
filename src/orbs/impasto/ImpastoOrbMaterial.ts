import type {OrbFill, OrbGlassOptions, OrbRay} from '../base/OrbGlassMaterial.ts'
import type {Node} from 'three/webgpu'

import {Break, float, fwidth, If, Loop, mix, select, time, vec3} from 'three/tsl'

import OrbGlassMaterial from '../base/OrbGlassMaterial.ts'
import {rgb, spinAroundY} from '../lib/fill.ts'
import {impastoHeight, impastoLook, impastoMapSize, impastoScoringSlope} from './paint.ts'
import {impastoBall} from './strokes.ts'

type Vec3 = Node<'vec3'>

/** how far apart the paint’s shape is sampled to find which way it faces, in orb radii: a little over two texels of its maps, smoothing their grid away */
const normalStep = Math.PI * 2 / impastoMapSize[0] * 2.2
/** the most steps the march takes from where it meets the ball’s outer shell to its core, and how long they are at least and at most, in orb radii; the longest is short enough not to step through the cut edge of a stroke */
const march = {
  steps: 96,
  stride: [0.0018, 0.018],
  refine: 6,
} as const
/** The loop names are supported by TSL but not yet declared by @types/three; keeping the options in variables preserves them without a cast. */
const marchLoop = {
  start: 0,
  end: march.steps,
  type: 'int',
  name: 'impastoStep',
} as const
const refineLoop = {
  start: 0,
  end: march.refine,
  type: 'int',
  name: 'impastoRefine',
} as const
/** where the light falls into the glass from, in the orb’s own frame: from above, the front and the left */
const light = vec3(-0.45, 0.8, 0.65).normalize()
/** where the bounce off the floor comes from, in the orb’s own frame: from below, behind and the right */
const bounceLight = vec3(0.5, -0.7, -0.5).normalize()
/** The point in the frame of the ball, whose axis leans {@link impastoBall}`.tilt` toward +z off the axis it turns round. */
function tilt(point: Vec3) {
  const cosine = Math.cos(impastoBall.tilt)
  const sine = Math.sin(impastoBall.tilt)
  return vec3(point.x, point.y.mul(cosine).sub(point.z.mul(sine)), point.y.mul(sine).add(point.z.mul(cosine)))
}
/** How far the point `q` of the ball’s frame lies above the paint’s shape, in orb radii, negative inside it. */
function above(q: Vec3) {
  return q.length().sub(impastoHeight(q.normalize()).mul(impastoBall.relief).add(impastoBall.core))
}

/**
 * A ball turning slowly in clear glass, its core hidden under knife strokes of heavy paint, a dusk over the sea wrapped round it: Prussian blue below, teal swells, alizarin and cadmium orange along a wavering horizon, Naples yellow and white above.
 * The strokes run round it in courses, slanting the other way from course to course like a herringbone, each lying over the one below, every stroke’s lip over where the next one set down; a twisted dab of paint caps either pole.
 * The paint is one surface, a height over the core, marched from the ball’s outer shell, so strokes lie on each other instead of passing through each other; the GPU bakes it into maps once (`paint.ts`), which the march reads.
 */
export default class ImpastoOrbMaterial extends OrbGlassMaterial {
  constructor(options: OrbGlassOptions) {
    super(options, {
      name: 'orb-impasto',
      tint: '#fff4df',
    })
  }

  protected override fill(ray: OrbRay): OrbFill {
    const angle = time.mul(-0.09)
    const toBall = (vector: Vec3) => tilt(spinAroundY(vector, angle))
    const origin = toBall(ray.origin).toVar('impastoOrigin')
    const direction = toBall(ray.direction).toVar('impastoDirection')
    // The ray starts on the unit sphere, heading in.
    const approach = origin.dot(direction).negate().toVar('impastoApproach')
    const outer = approach.mul(approach).sub(1 - (impastoBall.core + impastoBall.relief) ** 2).toVar('impastoOuter')
    const inner = approach.mul(approach).sub(1 - impastoBall.core ** 2).toVar('impastoInner')
    const enter = approach.sub(outer.max(0).sqrt())
    const end = select(inner.greaterThan(0), approach.sub(inner.max(0).sqrt()), approach.add(outer.max(0).sqrt())).toVar('impastoEnd')
    const depth = enter.add(ray.jitter.mul(march.stride[0])).toVar('impastoDepth')
    const previous = enter.toVar('impastoPrevious')
    const hit = float(0).toVar('impastoHit')
    If(outer.greaterThan(0), () => {
      Loop(marchLoop, () => {
        const gap = above(origin.add(direction.mul(depth)))
        If(gap.lessThan(1e-5), () => {
          hit.assign(1)
          Break()
        })
        If(depth.greaterThanEqual(end), () => {
          Break()
        })
        previous.assign(depth)
        // The height field is no true distance: its cut edges stand straight up, so the stride stays short enough not to pass through one.
        depth.assign(depth.add(gap.mul(0.6).clamp(march.stride[0], march.stride[1])).min(end))
      })
      // A ray grazing the paint can run out of steps creeping along it before it finds it; it is as good as there. Nor does any ray pass the paint down to the core, which lies under it everywhere.
      If(depth.lessThan(end).or(inner.greaterThan(0)), () => {
        hit.assign(1)
      })
      If(hit.greaterThan(0), () => {
        const low = previous.toVar('impastoLow')
        Loop(refineLoop, () => {
          const middle = low.add(depth).mul(0.5)
          If(above(origin.add(direction.mul(middle))).lessThan(0), () => {
            depth.assign(middle)
          }).Else(() => {
            low.assign(middle)
          })
        })
      })
    })
    const point = origin.add(direction.mul(depth)).toVar('impastoPoint')
    const gap = above(point)
    const shapeGradient = vec3(
      above(point.add(vec3(normalStep, 0, 0))).sub(gap),
      above(point.add(vec3(0, normalStep, 0))).sub(gap),
      above(point.add(vec3(0, 0, normalStep))).sub(gap),
    ).div(normalStep)
    // The scoring’s slope tilts the surface away from where it rises; it fades out where a pixel spans more than a few of its streaks, before it could flicker.
    const detail = fwidth(point).length().smoothstep(normalStep * 3, normalStep * 0.8)
    const normal = shapeGradient.sub(impastoScoringSlope(point.normalize()).mul(detail.mul(impastoBall.relief).div(point.length()))).normalize().toVar('impastoNormal')
    const look = impastoLook(point.normalize())
    const lighting = toBall(light)
    const up = toBall(vec3(0, 1, 0))
    // Wrapped round a little, as the glass and the room scatter the light into the shaded side.
    const key = normal.dot(lighting).add(0.3).div(1.3).max(0)
    // A warm bounce off the floor reaches up into the paint from below and behind.
    const bounce = normal.dot(toBall(bounceLight)).max(0)
    // The room’s light from above is warm, from below it is the cool bounce of the floor; it never leaves the deep blues black.
    const sky = mix(rgb('#8f9cc0'), rgb('#f4e9d4'), normal.dot(up).mul(0.5).add(0.5))
    const halfway = lighting.sub(direction).normalize()
    const facing = normal.dot(halfway).max(0)
    // Fresh oil paint has a buttery satin sheen on its planed flats and is wet and glossy where the knife pushed it up into ridges and lips.
    const gloss = facing.pow(14).mul(0.1).add(facing.pow(40).mul(look.gloss.mul(0.32).add(0.08)))
    // Whoever looks into the glass lets a little light in with their view, so no paint facing them is lost in shadow.
    const toward = normal.dot(direction.negate()).max(0)
    const rim = toward.oneMinus().pow(3).mul(0.12)
    const lit = look.color.mul(key.mul(0.7).add(sky.mul(0.42)).add(rgb('#ffd2a8').mul(bounce.mul(0.4))).add(toward.mul(0.22))).add(rgb('#fff3dc').mul(gloss)).add(sky.mul(rim))
    return {
      radiance: lit.mul(depth.mul(-0.1).exp()).mul(hit),
      transmittance: hit.oneMinus(),
    }
  }
}
