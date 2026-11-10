import type {FillLayer, OrbGlassOptions, OrbRay} from '../base/OrbGlassMaterial.ts'
import type {Node} from 'three/webgpu'

import {color, cross, float, mix, mx_fractal_noise_float, select, smoothstep, time, vec3} from 'three/tsl'

import OrbGlassMaterial from '../base/OrbGlassMaterial.ts'
import {coverage, ellipsoidHit, planeDepth, rgb, spinAroundY} from '../lib/fill.ts'
import {orbFractalNoise, orbNoise} from '../lib/noise.ts'

const steps = 40
/** the radius of the moon in the middle, in radii of the orb */
const moonRadius = 0.23
/** Each bat circles the moon in a tilted ring, rising and falling, and beats its wings at its own pace. */
const bats = [{
  radius: 0.5,
  height: 0.08,
  rate: 1.1,
  tilt: 0.3,
  phase: 0,
  span: 0.2,
  beat: 11,
}, {
  radius: 0.6,
  height: -0.22,
  rate: -0.85,
  tilt: -0.4,
  phase: 1.9,
  span: 0.24,
  beat: 9,
}, {
  radius: 0.44,
  height: 0.3,
  rate: 1.3,
  tilt: 0.7,
  phase: 3.7,
  span: 0.17,
  beat: 13,
}, {
  radius: 0.66,
  height: 0.05,
  rate: 0.7,
  tilt: -0.9,
  phase: 5.1,
  span: 0.21,
  beat: 10,
}, {
  radius: 0.4,
  height: -0.38,
  rate: -1.2,
  tilt: 0.15,
  phase: 2.6,
  span: 0.16,
  beat: 14,
}, {
  radius: 0.56,
  height: 0.36,
  rate: -0.95,
  tilt: -0.2,
  phase: 4.4,
  span: 0.19,
  beat: 12,
}, {
  radius: 0.52,
  height: -0.05,
  rate: 0.9,
  tilt: 1.2,
  phase: 0.9,
  span: 0.18,
  beat: 10.5,
}, {
  radius: 0.7,
  height: 0.12,
  rate: -0.75,
  tilt: 0.5,
  phase: 3.1,
  span: 0.2,
  beat: 9.5,
}, {
  radius: 0.62,
  height: -0.3,
  rate: 1,
  tilt: -0.7,
  phase: 5.8,
  span: 0.22,
  beat: 11.5,
}, {
  radius: 0.72,
  height: -0.08,
  rate: 0.6,
  tilt: 0.05,
  phase: 1.4,
  span: 0.23,
  beat: 8.5,
}, {
  radius: 0.58,
  height: -0.45,
  rate: -0.7,
  tilt: 0.25,
  phase: 0.3,
  span: 0.2,
  beat: 10,
}, {
  radius: 0.48,
  height: 0.48,
  rate: 0.8,
  tilt: -0.3,
  phase: 2.9,
  span: 0.18,
  beat: 12.5,
}, {
  radius: 0.68,
  height: 0.25,
  rate: 1.05,
  tilt: -1.1,
  phase: 4.9,
  span: 0.21,
  beat: 9,
}, {
  radius: 0.64,
  height: -0.18,
  rate: -1.15,
  tilt: 0.85,
  phase: 3.9,
  span: 0.19,
  beat: 13.5,
}]
const moonColor = color('#ffe3a1')
const mariaColor = color('#c27a2e')
const hazeColor = color('#ff7b1c')
const duskColor = color('#3a0f3f')
const glowColor = color('#ff9a3c')
const batColor = rgb('#07030a')
/** what the moon glows through a wing’s membrane in */
const membraneColor = rgb('#ff5a1a')
/** where a bat is and how it is turned: forward, up and to its left */
function batFrame({radius, height, rate, tilt, phase}: typeof bats[number]) {
  const angle = time.mul(rate).add(phase)
  const bob = time.mul(Math.abs(rate) * 2.3).add(phase * 1.3).sin()
  const [cosine, sine] = [Math.cos(tilt), Math.sin(tilt)]
  const tilted = (x: Node<'float'>, y: Node<'float'>, z: Node<'float'>) => vec3(x, y.mul(cosine).sub(z.mul(sine)), y.mul(sine).add(z.mul(cosine)))
  const center = tilted(angle.cos().mul(radius), bob.mul(0.07).add(height), angle.sin().mul(radius))
  const direction = Math.sign(rate)
  // Along the ring, climbing and diving a little with the bob.
  const forward = tilted(angle.sin().mul(-direction), time.mul(Math.abs(rate) * 2.3).add(phase * 1.3).cos().mul(0.25), angle.cos().mul(direction)).normalize()
  // Banked into the turn.
  const inward = tilted(angle.cos().negate(), float(0), angle.sin().negate())
  const up = tilted(float(0), float(1), float(0)).add(inward.mul(0.35)).normalize()
  const upright = up.sub(forward.mul(up.dot(forward))).normalize()
  return {
    center,
    forward,
    up: upright,
    left: cross(upright, forward),
  }
}
/**
 * How much of a wing the point covers, from where it lies along the wing’s span, 0 at the shoulder and 1 at the tip, and along the bat, forward positive, in spans.
 * A bat’s wing is a membrane stretched between its fingers: a leading edge bowed forward to the wrist and swept back to the tip, and a trailing edge scalloped between the fingertips.
 */
function wingInside(along: Node<'float'>, ahead: Node<'float'>) {
  const s = along.clamp(0, 1)
  const leading = float(0.06).add(s.mul(0.36)).sub(s.mul(s).mul(0.5))
  const fingers = s.sub(0.1).div(0.3).max(0)
  const scallop = fingers.fract().mul(Math.PI).sin().pow(0.7).mul(0.1).mul(select(s.greaterThan(0.1), float(1), float(0)))
  const trailing = float(-0.34).add(s.mul(0.24)).add(scallop)
  return leading.sub(ahead).min(ahead.sub(trailing)).min(along.add(0.02)).min(float(1).sub(along))
}
/**
 * Where the bones of a wing are, 0–1, from the same coordinates as {@link wingInside}: the arm along the leading edge to the wrist, and the fingers fanning from the wrist to the points of the trailing edge.
 */
function wingBones(along: Node<'float'>, ahead: Node<'float'>) {
  const s = along.clamp(0, 1)
  const leading = float(0.06).add(s.mul(0.36)).sub(s.mul(s).mul(0.5))
  const arm = coverage(float(0.018).sub(leading.sub(0.02).sub(ahead).abs())).mul(select(s.lessThan(0.4), float(1), float(0)))
  // The wrist sits on the leading edge at 0.35 of the span, each finger runs from it to a point between two scallops.
  const wrist = [0.35, 0.21] as const
  let fingers: Node<'float'> = float(0)
  for (const tip of [[0.4, -0.25], [0.7, -0.18], [1, -0.1]] as const) {
    const run = [tip[0] - wrist[0], tip[1] - wrist[1]]
    const length = Math.hypot(...run)
    const across = s.sub(wrist[0]).mul(-run[1] / length).add(ahead.sub(wrist[1]).mul(run[0] / length))
    const reach = s.sub(wrist[0]).mul(run[0] / length).add(ahead.sub(wrist[1]).mul(run[1] / length))
    fingers = fingers.max(coverage(float(0.012).sub(across.abs())).mul(coverage(reach)).mul(coverage(float(length).sub(reach))))
  }
  return arm.max(fingers)
}

/** A harvest moon glowing in the middle of the glass through drifting orange haze, and a swarm of bats beating around it, black against the glow; a wing passing before the moon glows through, its bones dark against the light. */
export default class BatsOrbMaterial extends OrbGlassMaterial {
  constructor(options: OrbGlassOptions) {
    super(options, {
      name: 'orb-bats',
      tint: '#c0602a',
    })
  }

  protected override fill(ray: OrbRay) {
    const {origin, direction} = ray
    const layers: Array<FillLayer> = []
    // The moon: lit evenly from inside, with darker seas and a dimmer rim.
    const moonApproach = origin.dot(direction).negate()
    const moonMiss = origin.add(direction.mul(moonApproach)).length()
    const moonDepth = moonApproach.sub(float(moonRadius * moonRadius).sub(moonMiss.mul(moonMiss)).max(0).sqrt())
    const moonSurface = origin.add(direction.mul(moonDepth)).normalize()
    const seas = mx_fractal_noise_float(moonSurface.mul(1.6).add(vec3(1.3, 0, 0)), 4, 2.2, 0.45).smoothstep(0.05, 0.3)
    const limb = moonSurface.dot(direction.negate()).max(0).pow(0.4)
    layers.push({
      depth: moonDepth,
      coverage: coverage(float(moonRadius).sub(moonMiss)),
      color: mix(moonColor, mariaColor, seas.mul(0.55)).mul(limb.mul(0.6).add(0.4)).mul(4),
    })
    for (const bat of bats) {
      const {center, forward, up, left} = batFrame(bat)
      const flap = time.mul(bat.beat).add(bat.phase * 3).sin()
      const raise = flap.mul(0.75).add(0.15)
      // Everything of a bat lies within a few centimeters, so it is one layer at the depth and in the color of what covers most.
      let depth: Node<'float'> = float(0)
      let covered: Node<'float'> = float(0)
      let shade: Node<'vec3'> = batColor
      for (const side of [1, -1]) {
        // Each wing turns about the body’s axis as it beats.
        const span = left.mul(raise.cos().mul(side)).add(up.mul(raise.sin()))
        const normal = cross(forward, span).normalize()
        const wingDepth = planeDepth(origin, direction, center, normal)
        const offset = origin.add(direction.mul(wingDepth)).sub(center)
        const along = offset.dot(span).div(bat.span)
        const ahead = offset.dot(forward).div(bat.span)
        const wing = coverage(wingInside(along, ahead))
        // The thin membrane lets the moon glow through where the wing passes before it.
        const backlight = moonMiss.sub(moonRadius).max(0).mul(-40).exp().mul(select(wingDepth.lessThan(moonDepth), float(1), float(0)))
        const wingShade = batColor.add(membraneColor.mul(backlight.mul(1.6)).mul(wingBones(along, ahead).oneMinus()))
        depth = select(wing.greaterThan(covered), wingDepth, depth)
        shade = select(wing.greaterThan(covered), wingShade, shade)
        covered = covered.max(wing)
      }
      // The body and the head, with a pair of ears.
      const headCenter = center.add(forward.mul(bat.span * 0.13)).add(up.mul(bat.span * 0.02))
      const parts = [
        ellipsoidHit(origin, direction, center.sub(forward.mul(bat.span * 0.05)), [forward, left, up], [bat.span * 0.17, bat.span * 0.075, bat.span * 0.07]),
        ellipsoidHit(origin, direction, headCenter, [forward, left, up], [bat.span * 0.06, bat.span * 0.055, bat.span * 0.055]),
        ...[1, -1].map(side => ellipsoidHit(origin, direction, headCenter.add(up.mul(bat.span * 0.06)).add(left.mul(bat.span * 0.03 * side)), [forward, left, up], [bat.span * 0.018, bat.span * 0.014, bat.span * 0.05])),
      ]
      for (const part of parts) {
        depth = select(part.coverage.greaterThan(covered), part.depth, depth)
        shade = select(part.coverage.greaterThan(covered), batColor, shade)
        covered = covered.max(part.coverage)
      }
      layers.push({
        depth,
        coverage: covered,
        color: shade,
      })
    }
    const fill = this.march(ray, steps, point => {
      // Drifting bands of haze, flattened like clouds, turning slowly around the moon.
      const drifting = spinAroundY(point, time.mul(0.08)).mul(vec3(1.4, 3.2, 1.4))
      const warped = drifting.add(orbNoise(drifting.mul(0.6).add(vec3(0, time.mul(0.05), 0))).xyz.mul(0.6))
      const cloud = orbFractalNoise(warped.mul(1.2), 4, 2.05, 0.55)
      const wisps = float(1).sub(orbNoise(warped.mul(3.1).add(7.7)).w.abs().mul(3.5)).max(0).pow(2)
      const haze = cloud.smoothstep(-0.05, 0.45).add(wisps.mul(0.35))
      const distance = point.length()
      // The moon lights the haze, strongest around it, its glow reddening as it travels.
      const moonlight = float(0.05).div(distance.sub(moonRadius).max(0).pow2().add(0.03))
      const lit = mix(duskColor, hazeColor, moonlight.smoothstep(0.1, 1.2)).mul(moonlight.mul(1.4).add(0.08))
      const wall = smoothstep(1, 0.88, distance)
      return {
        absorption: float(0.35),
        density: haze.mul(2.2).mul(wall),
        color: lit,
        // Glow scattered straight off the moon, which gives it a halo.
        emission: hazeColor.mul(float(0.012).div(distance.sub(moonRadius).max(0).pow2().add(0.004))),
      }
    }, layers)
    // Behind it all, a dusk sky glowing around the moon, which the bats show black against everywhere.
    const sky = mix(glowColor, duskColor, moonMiss.smoothstep(0.2, 0.95)).mul(moonMiss.smoothstep(0.2, 1).oneMinus().mul(2.4).add(0.35))
    return {
      radiance: fill.radiance.add(sky.mul(fill.transmittance)),
      transmittance: fill.transmittance.mul(0.2),
    }
  }
}
