import type {OrbGlassOptions, OrbRay} from '../base/OrbGlassMaterial.ts'
import type {Node} from 'three/webgpu'

import hsl from 'okhsl'
import {array, Break, cos, cross, exp, float, Fn, If, Loop, max, min, mix, pow, reflect, refract, select, sin, smoothstep, time, vec2, vec3, vec4} from 'three/tsl'

import OrbGlassMaterial from '../base/OrbGlassMaterial.ts'
import {rgb, spinAroundY, turn} from '../lib/fill.ts'
import {orbNoise} from '../lib/noise.ts'
import {crystalBoundRadius, frostFillIor, frostFlakes} from './crystal.ts'

const mistSteps = 32
const marchSteps = 56
/** precomputed orbiting snow motes & micro-crystals */
const flakeOrbits = array(frostFlakes.map(({angle, fall, height, radius}) => vec4(angle, radius, height, fall)))
const flakeLooks = array(frostFlakes.map(({hero, orbit, phase, size}) => vec4(size, orbit, phase, hero)))
const deepSapphire = rgb(hsl.integer(238, 88, 11))
const glacierBlue = rgb(hsl.integer(226, 86, 38))
const electricCyan = rgb(hsl.integer(212, 94, 72))
const frostWhite = rgb(hsl.integer(206, 30, 99))
const coreGlow = rgb(hsl.integer(212, 96, 82))
const snowShadow = rgb(hsl.integer(224, 72, 64))
const snowBright = rgb(hsl.integer(210, 22, 99))
const rimFrostColor = rgb(hsl.integer(212, 76, 94))
/** Smooth polynomial minimum matching `crystal.ts`. */
function smin(a: Node<'float'>, b: Node<'float'>, k: number) {
  const h = b.sub(a).div(k).mul(0.5).add(0.5).clamp(0, 1)
  return mix(b, a, h).sub(h.mul(h.oneMinus()).mul(k))
}
/** Signed distance to a slender, faceted diamond-section ice blade, matching `iceBladeDistance` in `crystal.ts`. */
function iceBladeDistance(along: Node<'float'>, asideA: Node<'float'>, asideB: Node<'float'>, bladeLength: number, w0: number, w1: number) {
  const t = along.div(bladeLength).clamp(0, 1)
  const w = mix(float(w0), float(w1), t)
  const crossDist = asideA.abs().add(asideB.abs()).sub(w).mul(Math.SQRT1_2)
  return max(crossDist, max(along.sub(bladeLength), along.negate()))
}
/**
 * Signed distance field of the full-3D octahedral glacial snowflake-star sculpture in its own frame, matching `crystalDistance` in `crystal.ts`.
 * Full 48-fold symmetry guarantees a breathtaking, intricate 3D crystal star from every angle in 360° with zero flat edge-on views.
 */
const crystalSdf = Fn(([point]: [Node<'vec3'>]) => {
  const px = point.x.abs()
  const py = point.y.abs()
  const pz = point.z.abs()
  // Sort (|x|, |y|, |z|) into a >= b >= c >= 0 in six min/max ops.
  const hi1 = max(px, py)
  const lo1 = min(px, py)
  const a = max(hi1, pz)
  const mid1 = min(hi1, pz)
  const b = max(lo1, mid1)
  const c = min(lo1, mid1)
  // 1. Jewel-cut octahedral crystal heart.
  const core = a.add(b).add(c).sub(0.19).mul(0.57735027)
  // 2. Six slender faceted primary crystal arms along ±x, ±y, ±z.
  const arm = iceBladeDistance(a, b, c, 0.57, 0.052, 0.005)
  // 3. Two 3D tiers of crisp 45° dendritic side-branches off every primary arm.
  const da1 = a.sub(0.21)
  const branch1 = iceBladeDistance(da1.add(b).mul(Math.SQRT1_2), b.sub(da1).mul(Math.SQRT1_2), c, 0.215, 0.028, 0.004)
  const da2 = a.sub(0.375)
  const branch2 = iceBladeDistance(da2.add(b).mul(Math.SQRT1_2), b.sub(da2).mul(Math.SQRT1_2), c, 0.135, 0.02, 0.004)
  // 4. Eight slender diagonal frost needles along (±1, ±1, ±1)/√3.
  const diagAlong = a.add(b).add(c).mul(0.57735027)
  const diagPerp1 = a.sub(b).mul(Math.SQRT1_2)
  const diagPerp2 = a.add(b).sub(c.mul(2)).mul(0.40824829)
  const diag = iceBladeDistance(diagAlong, diagPerp1, diagPerp2, 0.44, 0.032, 0.004)
  const mainStar = smin(min(arm, min(branch1, branch2)), core, 0.012)
  return smin(mainStar, diag, 0.012)
})
/** Luminous arctic skylight & caustic reflections sampled along reflected and refracted rays inside the cut crystal. */
function crystalEnv(dir: Node<'vec3'>) {
  const sky = smoothstep(-0.4, 0.7, dir.y)
  const base = mix(deepSapphire, glacierBlue, sky)
  const keyFlash = pow(dir.dot(vec3(0.38, 0.85, 0.36).normalize()).max(0), float(14)).mul(2.8)
  const sideGlow = pow(dir.dot(vec3(-0.78, 0.25, -0.57).normalize()).max(0), float(8)).mul(1.8)
  const bottomBounce = pow(dir.dot(vec3(0.55, -0.45, -0.7).normalize()).max(0), float(12)).mul(1.4)
  return base.add(frostWhite.mul(keyFlash)).add(electricCyan.mul(sideGlow.add(bottomBounce)))
}
/** Graceful slow tumbling rotation of the 3D crystal star (tilted 24° on x and 16° on z so its 6 primary axes never align rigidly with the world axes). */
function toCrystalFrame(point: Node<'vec3'>, spinAngle: Node<'float'>) {
  const tiltedX = vec3(point.x, point.y.mul(0.9135).sub(point.z.mul(0.4067)), point.y.mul(0.4067).add(point.z.mul(0.9135)))
  const tilted = vec3(tiltedX.x.mul(0.9613).sub(tiltedX.y.mul(0.2756)), tiltedX.x.mul(0.2756).add(tiltedX.y.mul(0.9613)), tiltedX.z)
  return spinAroundY(tilted, spinAngle)
}

/**
 * A luminous, translucent 3D octahedral glacial snowflake-star slowly turning inside crystal-clear icy glass (`ior = 1.31`), wrapped in airy snow-white swirling blizzard ribbons and 72 sparkling frost motes, ringed by a crisp sub-zero frosted Fresnel rim.
 */
export default class FrostOrbMaterial extends OrbGlassMaterial {
  constructor(options: OrbGlassOptions) {
    super(options, {
      name: 'orb-frost',
      fillIor: frostFillIor,
      tint: hsl.integer(216, 74, 92),
    })
  }

  protected override fill(ray: OrbRay) {
    const {origin, direction, eye, length: chordLength, jitter} = ray
    const spinAngle = time.mul(-0.24).toVar('frostSpin')
    const localOrigin = toCrystalFrame(origin, spinAngle).toVar('frostLocalO')
    const localDir = toCrystalFrame(direction, spinAngle).normalize().toVar('frostLocalD')
    // Analytical bounding-sphere intersection for the 3D crystal sculpture.
    const b = localOrigin.dot(localDir)
    const c = localOrigin.dot(localOrigin).sub(crystalBoundRadius * crystalBoundRadius)
    const disc = b.mul(b).sub(c)
    const hitDepth = float(100).toVar('frostHitDepth')
    const crystalColor = vec3(0).toVar('frostCrystalColor')
    const crystalAlpha = float(0).toVar('frostCrystalAlpha')
    If(disc.greaterThan(0), () => {
      const root = disc.sqrt()
      const tStart = b.negate().sub(root).max(0)
      const tEnd = b.negate().add(root).min(chordLength)
      const t = tStart.toVar('frostMarchT')
      const hit = float(0).toVar('frostHit')
      Loop(marchSteps, () => {
        const p = localOrigin.add(localDir.mul(t))
        const dist = crystalSdf(p)
        If(dist.lessThan(0.0012), () => {
          hit.assign(1)
          Break()
        })
        t.addAssign(dist.mul(0.72).max(0.0015))
        If(t.greaterThan(tEnd), () => {
          Break()
        })
      })
      If(hit.greaterThan(0.5), () => {
        hitDepth.assign(t)
        const hitPos = localOrigin.add(localDir.mul(t)).toVar('frostHitPos')
        const eps = 0.0014
        const n = vec3(1, -1, -1).mul(crystalSdf(hitPos.add(vec3(eps, -eps, -eps))))
          .add(vec3(-1, -1, 1).mul(crystalSdf(hitPos.add(vec3(-eps, -eps, eps)))))
          .add(vec3(-1, 1, -1).mul(crystalSdf(hitPos.add(vec3(-eps, eps, -eps)))))
          .add(vec3(1, 1, 1).mul(crystalSdf(hitPos.add(vec3(eps, eps, eps)))))
          .normalize().toVar('frostNormal')
        const viewDir = localDir.negate()
        const ndotv = n.dot(viewDir).clamp(0, 1)
        const fresnel = pow(ndotv.oneMinus(), float(2.1))
        const reflDir = reflect(localDir, n)
        const refrDir = refract(localDir, n, 1 / frostFillIor)
        const reflected = crystalEnv(reflDir)
        const refracted = crystalEnv(refrDir)
        // Internal thickness probe: thin dendritic tips glow radiant ice-white & cyan, thick core glows luminous glacier sapphire.
        const deepSample = crystalSdf(hitPos.add(refrDir.mul(0.07)))
        const thinness = smoothstep(-0.045, 0.015, deepSample).toVar('frostThin')
        const radial = hitPos.length()
        const corePulse = sin(time.mul(1.8)).mul(0.1).add(1)
        const heartGlow = exp(radial.mul(-5.8)).mul(corePulse)
        // Razor-crisp jewel catchlights across flat cut ice facets.
        const keyDir = vec3(0.42, 0.84, 0.34).normalize()
        const halfKey = keyDir.add(viewDir).normalize()
        const specMirror = pow(n.dot(halfKey).max(0), float(140)).mul(4.6)
        const rimWhite = pow(fresnel, float(1.75)).mul(2.4)
        const body = mix(deepSapphire, glacierBlue, thinness.mul(0.65).add(0.12)).add(refracted.mul(thinness.mul(0.65).add(0.26)))
        const luminous = mix(body, reflected.mul(1.45), fresnel.mul(0.78).add(0.18))
          .add(electricCyan.mul(thinness.mul(0.7).add(0.06)))
          .add(coreGlow.mul(heartGlow.mul(1.7)))
          .add(frostWhite.mul(specMirror.add(rimWhite)))
        crystalColor.assign(luminous)
        // Translucent refractive glacier crystal — dark deep center, crystal-clear facets, blinding icy bevels.
        crystalAlpha.assign(mix(float(0.72), float(0.98), fresnel.max(heartGlow.mul(0.4))))
      })
    })
    // 72 crisp, bright snow motes and twinkling diamond-dust flecks orbiting through the blizzard vortex.
    const rayUp = vec3(0, 1, 0).sub(direction.mul(direction.y)).normalize().toVar('frostRayUp')
    const rayRight = cross(direction, rayUp).toVar('frostRayRight')
    const frontFlakeLight = vec3(0).toVar('frostFrontFlakeL')
    const frontFlakeAlpha = float(0).toVar('frostFrontFlakeA')
    const frontFlakeDepth = float(100).toVar('frostFrontFlakeD')
    const backFlakeLight = vec3(0).toVar('frostBackFlakeL')
    const backFlakeAlpha = float(0).toVar('frostBackFlakeA')
    Loop(frostFlakes.length, ({i}) => {
      const orbData = flakeOrbits.element(i)
      const lookData = flakeLooks.element(i)
      const az = orbData.x.add(time.mul(lookData.y))
      const bob = sin(time.mul(1.4).add(lookData.z)).mul(0.045).add(cos(time.mul(orbData.w.mul(4.5)).add(lookData.z.mul(1.7))).mul(0.025))
      const center = vec3(cos(az).mul(orbData.y), orbData.z.add(bob), sin(az).mul(orbData.y))
      const depth = center.sub(origin).dot(direction)
      If(depth.greaterThan(0.03).and(depth.lessThan(chordLength.sub(0.03))), () => {
        const offset = origin.add(direction.mul(depth)).sub(center)
        const size = lookData.x
        const dist = offset.length()
        If(dist.lessThan(size.mul(1.85)), () => {
          const local2D = turn(vec2(offset.dot(rayRight), offset.dot(rayUp)).div(size), time.mul(lookData.y.mul(2.8)).add(lookData.z))
          const r = local2D.length()
          const crossSpark = exp(local2D.x.abs().mul(5).add(local2D.y.abs().mul(1)).negate()).max(exp(local2D.y.abs().mul(5).add(local2D.x.abs().mul(1)).negate()))
          const coreDot = exp(r.mul(r).mul(-3.6))
          const shape = select(lookData.w.greaterThan(0.5), max(coreDot, crossSpark.mul(0.9)), coreDot)
          const depthCue = smoothstep(chordLength, float(0.1), depth)
          const twinkle = sin(time.mul(5.8).add(lookData.z.mul(5.7))).mul(0.5).add(0.5).pow(3)
          const flakeAlpha = shape.mul(mix(float(0.45), float(0.9), depthCue)).mul(twinkle.mul(0.45).add(0.55)).clamp(0, 0.92)
          const flakeColor = mix(electricCyan, frostWhite, depthCue.mul(0.55).add(twinkle.mul(0.45))).mul(twinkle.mul(2.2).add(1.55))
          If(depth.lessThan(hitDepth), () => {
            frontFlakeDepth.assign(min(frontFlakeDepth, depth))
            frontFlakeLight.addAssign(flakeColor.mul(flakeAlpha).mul(frontFlakeAlpha.oneMinus()))
            frontFlakeAlpha.assign(frontFlakeAlpha.add(flakeAlpha.mul(frontFlakeAlpha.oneMinus())).clamp(0, 0.9))
          }).Else(() => {
            backFlakeLight.addAssign(flakeColor.mul(flakeAlpha).mul(backFlakeAlpha.oneMinus()))
            backFlakeAlpha.assign(backFlakeAlpha.add(flakeAlpha.mul(backFlakeAlpha.oneMinus())).clamp(0, 0.9))
          })
        })
      })
    })
    // Volumetric airy snow-white swirling blizzard ribbons inside crystal-clear ice-tinted glass.
    const step = chordLength.div(mistSteps).toVar('frostMistStep')
    const radiance = vec3(0).toVar('frostRadiance')
    const transmittance = float(1).toVar('frostTransmittance')
    const frontFlakeDone = float(0).toVar('frostFrontFlakeDone')
    const crystalDone = float(0).toVar('frostCrystalDone')
    Loop({
      start: 0,
      end: mistSteps,
      type: 'int',
    }, ({i}) => {
      const near = float(i).mul(step)
      const far = near.add(step)
      If(frontFlakeDone.lessThan(0.5).and(frontFlakeAlpha.greaterThan(0)).and(frontFlakeDepth.greaterThanEqual(near)).and(frontFlakeDepth.lessThan(far)), () => {
        radiance.addAssign(frontFlakeLight.mul(transmittance))
        transmittance.mulAssign(frontFlakeAlpha.mul(0.7).oneMinus())
        frontFlakeDone.assign(1)
      })
      If(crystalDone.lessThan(0.5).and(crystalAlpha.greaterThan(0)).and(hitDepth.greaterThanEqual(near)).and(hitDepth.lessThan(far)), () => {
        radiance.addAssign(crystalColor.mul(crystalAlpha).mul(transmittance))
        transmittance.mulAssign(crystalAlpha.oneMinus())
        crystalDone.assign(1)
      })
      const depth = float(i).add(jitter).mul(step)
      const point = origin.add(direction.mul(depth))
      const radius = point.length()
      // Singularity-free 3D helical snow-mist ribbons spiraling cleanly around the crystal heart (zero polar pinching!).
      const twist = time.mul(0.42).add(radius.oneMinus().mul(2.1))
      const swirled = spinAroundY(point, twist).mul(2.2).add(vec3(0, time.mul(0.24), 0))
      const warped = swirled.add(orbNoise(swirled.mul(0.85)).xyz.mul(0.45))
      const equatorBand = point.y.abs().smoothstep(0.82, 0.12).mul(0.75).add(0.25)
      const wisp = float(1).sub(orbNoise(warped.mul(2.3)).x.abs().mul(2.6)).max(0).pow(2.2)
      const snowFlurry = orbNoise(warped.mul(5).add(2.3)).y.mul(0.5).add(0.5).smoothstep(0.54, 0.92)
      const ringMask = smoothstep(0.95, 0.7, radius).mul(smoothstep(0.34, 0.56, radius))
      const density = wisp.mul(equatorBand).add(snowFlurry.mul(0.4)).mul(ringMask).mul(1.75)
      // Luminous snow-white & glacier-blue scattering inside crystal-clear liquid.
      const coreLight = float(0.075).div(radius.mul(radius).add(0.07))
      const scatterColor = mix(snowShadow, snowBright, coreLight.add(wisp.mul(0.65)).smoothstep(0.18, 0.92)).mul(coreLight.mul(1.15).add(1.1))
      const extinction = density.add(0.12)
      const absorbed = extinction.mul(step).negate().exp().oneMinus()
      const scattered = scatterColor.mul(absorbed.mul(density).div(extinction.max(1e-4)))
      const aura = coreGlow.mul(exp(radius.mul(-5.8)).mul(0.32).mul(step))
      radiance.addAssign(scattered.add(aura).mul(transmittance))
      transmittance.mulAssign(absorbed.oneMinus())
      If(transmittance.lessThan(0.004), () => {
        Break()
      })
    })
    // Rear sparkling snow motes peeking through the clear spaces between crystal arms.
    radiance.addAssign(backFlakeLight.mul(transmittance))
    transmittance.mulAssign(backFlakeAlpha.mul(0.55).oneMinus())
    // Exterior view rim: crisp icy Fresnel sheen & subtle sub-zero rime glow hugging the curved glass edge.
    const viewDir = eye.sub(origin).normalize()
    const viewRim = float(1).sub(origin.dot(viewDir).abs()).clamp(0, 1)
    const rimeNoise = orbNoise(origin.mul(6).add(vec3(0, 0, time.mul(0.02)))).z.mul(0.5).add(0.5)
    const rimGlow = pow(viewRim, float(3.2)).mul(rimeNoise.mul(0.4).add(0.6))
    radiance.addAssign(mix(electricCyan, rimFrostColor, rimGlow).mul(rimGlow.mul(1.35)))
    return {
      radiance,
      transmittance: transmittance.clamp(0.08, 1),
    }
  }
}
