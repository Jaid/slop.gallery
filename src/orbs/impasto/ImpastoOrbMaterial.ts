import type {OrbGlassOptions, OrbRay} from '../base/OrbGlassMaterial.ts'
import type {Node} from 'three/webgpu'

import {array, atan, Break, exp, float, Fn, If, Loop, max, min, mix, smoothstep, time, vec2, vec3, vec4} from 'three/tsl'

import OrbGlassMaterial from '../base/OrbGlassMaterial.ts'
import {rgb, spinAroundY} from '../lib/fill.ts'
import {orbNoise} from '../lib/noise.ts'
import {impastoBubbles, impastoPalette, impastoStrokes, strokeBoundRadius, strokeSurfaceDistance} from './strokes.ts'

/** Distinct loop name keeps the inner raymarch index from shadowing the outer stroke loop index in TSL array lookups. */
const march = {
  end: 72,
  name: 'impastoStep',
  start: 0,
  type: 'int',
} as const
const paints = array(impastoPalette.map(rgb))
const longs = array(impastoStrokes.map(stroke => vec3(stroke.along)))
const widths = array(impastoStrokes.map(stroke => vec3(stroke.across)))
const normals = array(impastoStrokes.map(stroke => vec3(stroke.normal)))
const boxMins = array(impastoStrokes.map(stroke => vec3(stroke.boxMin)))
const boxMaxs = array(impastoStrokes.map(stroke => vec3(stroke.boxMax)))
const shapesA = array(impastoStrokes.map(stroke => vec4(stroke.shell, stroke.arc, stroke.width, stroke.thick)))
const shapesB = array(impastoStrokes.map(stroke => vec4(stroke.bend, stroke.lift, stroke.tilt, stroke.seed)))
const pigmentPairs = array(impastoStrokes.map(stroke => vec2(stroke.pigment, stroke.folded)))
const bubbles = array(impastoBubbles.map(bubble => vec4(bubble.center.x, bubble.center.y, bubble.center.z, bubble.radius)))
const keyLight = vec3(-0.48, 0.82, 0.36).normalize()
const fillLight = vec3(0.68, 0.24, -0.58).normalize()
const bounceLight = vec3(0.22, -0.86, -0.34).normalize()
/**
 * Signed distance in orb radii from a local stroke-frame point `p` (`x` along, `y` across, `z` outward) to a thick, heavy-bodied impasto dollop.
 * Bristle tracks run in constant physical cross-blade distance (`aShifted`) so grooves exit cleanly across torn edges instead of pinching into leaf tips.
 * Matches `strokeDistance` in `strokes.ts` term for term.
 */
const strokeDistance = Fn(([p, shapeA, shapeB]: [Node<'vec3'>, Node<'vec4'>, Node<'vec4'>]) => {
  const shell = shapeA.x
  const arc = shapeA.y
  const width = shapeA.z
  const thick = shapeA.w
  const bend = shapeB.x
  const lift = shapeB.y
  const tilt = shapeB.z
  const seed = shapeB.w
  const rxz = vec2(p.x, p.z).length()
  const radius = p.length()
  const sRaw = atan(p.x, p.z).mul(shell)
  const aRaw = atan(p.y, rxz.max(1e-5)).mul(shell)
  const hRaw = radius.sub(shell)
  const u = sRaw.div(arc).clamp(-1.4, 1.4)
  const whip = u.sub(0.15).max(0)
  const hook = bend.mul(u.mul(u).mul(0.7).sub(0.18).add(whip.mul(whip).mul(0.85).mul(tilt)))
  const aBent = aRaw.sub(hook)
  const heel = smoothstep(-1.02, -0.38, u).mul(0.56).add(0.44)
  const tip = smoothstep(1.06, 0.26, u)
  const silhouette = heel.mul(tip.max(1e-5).pow(0.88).mul(0.9).add(0.1))
  const asymShift = width.mul(0.34).mul(tilt).mul(smoothstep(0.08, 0.96, u))
  const aShifted = aBent.sub(asymShift)
  const torn = u.mul(4.7).add(seed).sin().mul(0.055).add(u.mul(11.3).add(seed.mul(1.9)).sin().mul(0.04)).add(u.mul(21.1).add(seed.mul(3.4)).sin().mul(0.028))
  const halfWidth = width.mul(silhouette).mul(torn.add(1))
  const v = aShifted.div(halfWidth.max(0.012)).clamp(-1.5, 1.5)
  const curl = smoothstep(-0.4, 1, u)
  const v2 = v.mul(v).min(1)
  const hCurl = lift.mul(curl.mul(curl).mul(0.82).add(u.max(0).mul(0.18))).mul(float(1).sub(v2).mul(0.35).add(0.65))
  const crossDome = float(1).sub(v2).max(1e-5).pow(0.42)
  const lengthBody = smoothstep(-1.04, -0.68, u).max(1e-5).pow(0.4).mul(smoothstep(1.06, 0.5, u).max(1e-5).pow(0.55))
  const body = crossDome.mul(lengthBody)
  const scoopArg = v.add(tilt.mul(0.26)).div(0.44)
  const scoop = exp(scoopArg.mul(scoopArg).negate()).mul(-0.46).mul(body)
  const crestArg = v.sub(tilt.mul(0.52)).div(0.28)
  const crestRidge = exp(crestArg.mul(crestArg).negate()).mul(0.92).mul(lengthBody).mul(crossDome.max(1e-5).pow(0.3))
  const backBeadArg = v.add(tilt.mul(0.76)).div(0.2)
  const backBead = exp(backBeadArg.mul(backBeadArg).negate()).mul(0.42).mul(lengthBody).mul(crossDome.max(1e-5).pow(0.35))
  const peakArg = u.sub(0.56).div(0.34)
  const pulledPeak = exp(peakArg.mul(peakArg).negate()).mul(0.72).mul(crossDome.max(1e-5).pow(0.45))
  const physPhase = aShifted.mul(52).add(sRaw.mul(10.2).add(seed).sin().mul(0.55)).add(sRaw.mul(20.5).add(seed.mul(2.1)).sin().mul(0.25))
  const trackBreak = sRaw.mul(13.5).add(aShifted.mul(10.8)).add(seed).sin().mul(0.55).add(0.45)
  const ridge1 = float(1).sub(physPhase.add(seed).sin().abs())
  const ridge2 = float(1).sub(physPhase.mul(2.27).add(seed.mul(1.9)).add(sRaw.mul(5)).sin().abs())
  const chunk = sRaw.mul(17.4).add(aShifted.mul(14.5)).add(seed).sin().mul(sRaw.mul(11.1).sub(aShifted.mul(19.6)).add(seed.mul(1.7)).cos())
  const relief = ridge1.sub(0.5).mul(0.14).mul(trackBreak).add(ridge2.sub(0.5).mul(0.08)).add(chunk.mul(0.13)).mul(body)
  const hBot = hCurl.sub(thick.mul(0.42).mul(body))
  const hTop = hCurl.add(thick.mul(body.mul(0.82).add(crestRidge).add(backBead).add(pulledPeak).add(scoop).add(relief)))
  const hMid = hTop.add(hBot).mul(0.5)
  const hHalf = hTop.sub(hBot).mul(0.5).max(0.0065)
  const heelBreak = arc.mul(aShifted.mul(22).add(seed).sin().mul(0.055).add(aShifted.mul(44).add(seed.mul(1.7)).cos().mul(0.03)))
  const headBreak = arc.mul(aShifted.mul(26).add(seed.mul(2.3)).sin().mul(0.065).add(aShifted.mul(52).add(seed).cos().mul(0.035)))
  const bevel = float(0.01).min(hHalf.mul(0.5)).min(halfWidth.mul(0.35))
  const qx = max(sRaw.negate().sub(arc.add(heelBreak).sub(bevel)), sRaw.sub(arc.add(headBreak).sub(bevel)))
  const qy = aShifted.abs().sub(halfWidth.sub(bevel))
  const qz = hRaw.sub(hMid).abs().sub(hHalf.sub(bevel))
  return vec3(qx, qy, qz).max(0).length().add(qx.max(qy).max(qz).min(0)).sub(bevel)
})

/**
 * A slowly turning two-layer sculpture of 12 thick, knife-sculpted heavy-body impasto dollops suspended in luminous golden-honey linseed oil with effervescent multi-scale air bubbles inside clear glass.
 * Eight bold outer dollops swirl around a square antiprism over four inner tetrahedral swirls with guaranteed 3D clearance so strokes never clip into each other. Constant physical-space bristle tracks, contrasted smooth knife scoops and rough craggy crests, radiant primary oil pigments with localized stretched marbling and 80 full-sphere bubbles bring the sculpture to life.
 */
export default class ImpastoOrbMaterial extends OrbGlassMaterial {
  constructor(options: OrbGlassOptions) {
    super(options, {
      fillIor: 1.28,
      name: 'orb-impasto',
      tint: '#fbe298',
    })
  }

  protected override fill(ray: OrbRay) {
    const angle = time.mul(-0.085)
    const origin = spinAroundY(ray.origin, angle).toVar('impastoOrigin')
    const direction = spinAroundY(ray.direction, angle).toVar('impastoDirection')
    const key = spinAroundY(keyLight, angle).toVar('impastoKey')
    const fill = spinAroundY(fillLight, angle).toVar('impastoFill')
    const bounce = spinAroundY(bounceLight, angle).toVar('impastoBounce')
    const nearest = ray.length.toVar('impastoDepth')
    const covered = float(0).toVar('impastoCovered')
    const hitLocal = vec3(0).toVar('impastoHitLocal')
    const hitNormal = vec3(0, 1, 0).toVar('impastoNormal')
    const hitAlong = vec3(1, 0, 0).toVar('impastoHitAlong')
    const hitAcross = vec3(0, 1, 0).toVar('impastoHitAcross')
    const hitShapeA = vec4(0.57, 0.31, 0.2, 0.09).toVar('impastoHitShapeA')
    const hitShapeB = vec4(0, 0, 1, 0).toVar('impastoHitShapeB')
    const hitPigments = vec2(0, 0).toVar('impastoHitPigments')
    const approach = origin.dot(direction).negate()
    const missSq = origin.add(direction.mul(approach)).lengthSq()
    If(missSq.lessThan(strokeBoundRadius ** 2), () => {
      Loop(impastoStrokes.length, ({i}) => {
        const along = longs.element(i)
        const across = widths.element(i)
        const outward = normals.element(i)
        const o = vec3(origin.dot(along), origin.dot(across), origin.dot(outward)).toVar()
        const d = vec3(direction.dot(along), direction.dot(across), direction.dot(outward)).toVar()
        const inverse = d.sign().add(vec3(d.equal(0))).div(d.abs().max(1e-6))
        const first = boxMins.element(i).sub(o).mul(inverse)
        const last = boxMaxs.element(i).sub(o).mul(inverse)
        const entry = min(first, last)
        const exit = max(first, last)
        const start = entry.x.max(entry.y).max(entry.z).max(0)
        const end = exit.x.min(exit.y).min(exit.z).min(nearest)
        If(start.lessThan(end), () => {
          const shapeA = shapesA.element(i).toVar()
          const shapeB = shapesB.element(i).toVar()
          const depth = start.toVar()
          Loop(march, () => {
            const point = o.add(d.mul(depth)).toVar()
            const distance = strokeDistance(point, shapeA, shapeB).toVar()
            If(distance.lessThan(strokeSurfaceDistance), () => {
              nearest.assign(depth)
              covered.assign(1)
              hitLocal.assign(point)
              hitAlong.assign(along)
              hitAcross.assign(across)
              hitShapeA.assign(shapeA)
              hitShapeB.assign(shapeB)
              hitPigments.assign(pigmentPairs.element(i))
              const step = 0.0032
              const gradient = vec3(
                strokeDistance(point.add(vec3(step, 0, 0)), shapeA, shapeB).sub(strokeDistance(point.sub(vec3(step, 0, 0)), shapeA, shapeB)),
                strokeDistance(point.add(vec3(0, step, 0)), shapeA, shapeB).sub(strokeDistance(point.sub(vec3(0, step, 0)), shapeA, shapeB)),
                strokeDistance(point.add(vec3(0, 0, step)), shapeA, shapeB).sub(strokeDistance(point.sub(vec3(0, 0, step)), shapeA, shapeB)),
              ).normalize()
              hitNormal.assign(along.mul(gradient.x).add(across.mul(gradient.y)).add(outward.mul(gradient.z)).normalize())
              Break()
            })
            depth.addAssign(distance.mul(0.56).max(0.0004))
            If(depth.greaterThanEqual(end), () => {
              Break()
            })
          })
        })
      })
    })
    // Reconstruct physical stroke coordinates (`sRaw`, `aShifted`) and normalized `(u, v)` at the hit point.
    const hitPoint = origin.add(direction.mul(nearest))
    const shell = hitShapeA.x
    const arc = hitShapeA.y
    const width = hitShapeA.z
    const bend = hitShapeB.x
    const tilt = hitShapeB.z
    const seed = hitShapeB.w
    const rxz = vec2(hitLocal.x, hitLocal.z).length()
    const hitRadius = hitLocal.length()
    const sRaw = atan(hitLocal.x, hitLocal.z).mul(shell)
    const u = sRaw.div(arc).clamp(-1.1, 1.1)
    const whip = u.sub(0.15).max(0)
    const hook = bend.mul(u.mul(u).mul(0.7).sub(0.18).add(whip.mul(whip).mul(0.85).mul(tilt)))
    const asymShift = width.mul(0.34).mul(tilt).mul(smoothstep(0.08, 0.96, u))
    const aShifted = atan(hitLocal.y, rxz.max(1e-5)).mul(shell).sub(hook).sub(asymShift)
    const heel = smoothstep(-1.02, -0.38, u).mul(0.56).add(0.44)
    const tip = smoothstep(1.06, 0.26, u)
    const halfWidth = width.mul(heel.mul(tip.max(1e-5).pow(0.88).mul(0.9).add(0.1)))
    const v = aShifted.div(halfWidth.max(0.012)).clamp(-1.1, 1.1)
    const view = direction.negate()
    // Sharp cusped hog-bristle & knife-drag micro-relief, gently tapered at extreme grazing angles so silhouettes stay smooth without zigzag creases.
    const flowNoise = orbNoise(vec3(sRaw.mul(3.4), aShifted.mul(17), seed.mul(1.7)))
    const fineGrit = orbNoise(hitPoint.mul(34).add(vec3(seed.mul(2.1), 0, seed)))
    const scoopArg = v.add(tilt.mul(0.26)).div(0.44)
    const scoopZone = exp(scoopArg.mul(scoopArg).negate())
    const crestArg = v.sub(tilt.mul(0.52)).div(0.28)
    const crestRidge = exp(crestArg.mul(crestArg).negate())
    const peakArg = u.sub(0.56).div(0.34)
    const pulledPeak = exp(peakArg.mul(peakArg).negate())
    const bristleWarp = sRaw.mul(9).add(seed).sin().mul(0.65)
    const bristleCoord = aShifted.mul(76).add(bristleWarp)
    const fineScratch = aShifted.mul(172).add(sRaw.mul(12.6).add(seed.mul(1.9)).sin().mul(0.7))
    const bristlePresence = smoothstep(-0.35, 0.4, flowNoise.y)
    const grazingFade = smoothstep(0.06, 0.36, hitNormal.dot(view).max(0))
    const roughnessZone = float(1).sub(scoopZone.mul(0.55)).add(crestRidge.mul(0.65)).add(pulledPeak.mul(0.45)).mul(grazingFade)
    const cuspSlope1 = bristleCoord.add(seed).sin().mul(3.8).clamp(-1, 1).negate().mul(bristleCoord.add(seed).cos())
    const cuspSlope2 = fineScratch.add(seed.mul(1.7)).sin().mul(3.8).clamp(-1, 1).negate().mul(fineScratch.add(seed.mul(1.7)).cos())
    const microSlopeV = cuspSlope1.mul(0.34).mul(bristlePresence)
      .add(cuspSlope2.mul(0.22))
      .add(fineGrit.x.mul(0.28))
      .mul(roughnessZone)
    const microSlopeU = flowNoise.z.mul(0.12).add(fineGrit.y.mul(0.22)).add(sRaw.mul(64).add(seed).cos().mul(0.04)).mul(roughnessZone)
    const sculptedNormal = hitNormal.add(hitAcross.mul(microSlopeV.mul(0.38))).add(hitAlong.mul(microSlopeU.mul(0.24))).normalize()
    // Dominant pure primary oil hue with silky, taut, strictly flow-aligned combed filaments along one flank (smooth sRaw warp only — zero blotchy contour islands).
    const primaryPaint = paints.element(hitPigments.x.toInt())
    const foldedPaint = paints.element(hitPigments.y.toInt())
    const flankZone = smoothstep(0.06, 0.78, v.mul(tilt).add(u.mul(0.14)))
    const silkCoord = aShifted.mul(50).add(sRaw.mul(4.1).add(seed).sin().mul(0.55))
    const silkRibbon = smoothstep(0.42, 0.54, silkCoord.add(seed.mul(1.3)).sin())
    const fineThread = smoothstep(0.58, 0.7, bristleCoord.mul(0.95).add(seed.mul(0.7)).sin())
    const crestStreak = smoothstep(0.72, 0.84, silkCoord.mul(1.75).add(seed.mul(2.1)).sin()).mul(smoothstep(0.35, 0.9, v.mul(tilt)))
    const pigment = mix(primaryPaint, foldedPaint, silkRibbon.mul(flankZone).max(fineThread.mul(flankZone).mul(0.88)).max(crestStreak.mul(0.92)))
    // Razor-sharp cusped ridge & torn-crust crests catch intense wet-oil glints over deep velvety chromatic crevices.
    const bristleCrest = float(1).sub(bristleCoord.add(seed).sin().abs()).pow(3).mul(bristlePresence)
    const scratchCrest = float(1).sub(fineScratch.add(seed.mul(1.7)).sin().abs()).pow(3)
    const cragEdge = fineGrit.w.abs().smoothstep(0.3, 0.74).mul(roughnessZone)
    const crestness = crestRidge.max(pulledPeak.mul(0.95)).max(bristleCrest.mul(0.75)).max(scratchCrest.mul(0.55)).max(cragEdge.mul(0.55)).clamp(0, 1)
    const valley = float(1).sub(crestness).mul(smoothstep(0.68, 0.18, hitRadius).mul(0.48).add(0.52))
    const keyDiff = sculptedNormal.dot(key).max(0)
    const fillDiff = sculptedNormal.dot(fill).max(0)
    const bounceDiff = sculptedNormal.dot(bounce).max(0)
    const viewSoft = sculptedNormal.dot(view.add(vec3(0, 0.35, 0)).normalize()).max(0)
    const depthAo = smoothstep(0.14, 0.48, hitRadius).mul(0.4).add(0.6)
    const creviceAo = float(1).sub(valley.mul(0.38)).mul(depthAo)
    const lit = keyDiff.mul(1.1).add(fillDiff.mul(0.24)).add(bounceDiff.mul(0.28)).add(viewSoft.mul(0.18)).mul(creviceAo)
    const shadowPigment = pigment.max(0.001).pow(1.36).mul(0.84)
    const richPigment = mix(shadowPigment, pigment, smoothstep(0.12, 0.72, lit))
    const lightTint = mix(vec3(0.74, 0.7, 0.78), vec3(1.18, 1.11, 1), smoothstep(0.08, 0.9, keyDiff))
      .add(vec3(0.12, 0.18, 0.28).mul(fillDiff))
      .add(vec3(0.4, 0.24, 0.06).mul(bounceDiff))
    // Crisp wet-oil glints along cusped bristle ridges & lifted crests contrasted against satin blade-planed scoops.
    const halfKey = key.add(view).normalize()
    const ndhKey = sculptedNormal.dot(halfKey).max(0)
    const fresnelPaint = float(1).sub(sculptedNormal.dot(view).max(0)).pow(3.2)
    const satin = ndhKey.pow(20).mul(float(0.12).add(scoopZone.mul(0.09)))
    const wetGlint = ndhKey.pow(130).mul(float(0.55).add(crestness.mul(1.75)))
    const microSparkle = ndhKey.pow(56).mul(bristleCrest.max(scratchCrest).max(cragEdge.mul(0.7))).mul(0.65)
    const sheen = vec3(1, 0.98, 0.92).mul(satin.add(wetGlint).add(microSparkle).add(fresnelPaint.mul(0.2)).mul(creviceAo))
    const oilAbsorption = exp(nearest.mul(vec3(-0.015, -0.08, -0.24)))
    const paintColor = richPigment.mul(lit.add(0.26)).mul(lightTint).add(sheen).mul(oilAbsorption)
    // True exterior viewing-angle rim (`viewRim` reaches 1.0 right at the glass edge, unlike refracted `ray.direction` which caps at ~0.33): drives jewel-like golden perimeter caustics and sunlit glass lensing.
    const outsideView = ray.eye.sub(ray.origin).normalize()
    const viewRim = float(1).sub(ray.origin.dot(outsideView).abs()).clamp(0, 1)
    const deepAmber = vec3(0.28, 0.12, 0.014).mul(ray.length.mul(0.32).add(0.1))
    const rimBand = smoothstep(0.42, 0.9, viewRim).mul(smoothstep(1, 0.94, viewRim).mul(0.35).add(0.65))
    const crispRing = smoothstep(0.76, 0.9, viewRim).mul(smoothstep(0.99, 0.92, viewRim))
    const rimCaustic = vec3(1.15, 0.72, 0.16).mul(rimBand.mul(0.95)).add(vec3(1.25, 0.96, 0.42).mul(crispRing.mul(0.9)))
    const topGlassArch = vec3(1, 0.96, 0.8).mul(smoothstep(0.42, 0.95, ray.origin.y).mul(smoothstep(0.55, 0.88, viewRim)).mul(1.15))
    const lowerCaustic = vec3(1.15, 0.74, 0.18).mul(smoothstep(-0.2, -0.92, ray.origin.y).mul(smoothstep(0.48, 0.9, viewRim)).mul(0.95))
    const mediumGlow = deepAmber.add(rimCaustic).add(topGlassArch).add(lowerCaustic).mul(covered.oneMinus())
    // 80 crisp, high-IOR refractive air bubbles across the full sphere: dark espresso-amber refractive rings, warm golden lower crescents and solid antialiased white specular pinpoints.
    const bubbleLight = vec3(0).toVar('impastoBubbleLight')
    const bubbleDim = float(1).toVar('impastoBubbleDim')
    Loop(impastoBubbles.length, ({i}) => {
      const bubble = bubbles.element(i)
      const toBubble = bubble.xyz.sub(origin)
      const proj = toBubble.dot(direction)
      const radiusSq = bubble.w.mul(bubble.w)
      const perpSq = toBubble.dot(toBubble).sub(proj.mul(proj))
      If(proj.greaterThan(0).and(perpSq.lessThan(radiusSq)), () => {
        const hitT = proj.sub(radiusSq.sub(perpSq).max(0).sqrt())
        If(hitT.greaterThan(0.004).and(hitT.lessThan(nearest)), () => {
          const bNormal = origin.add(direction.mul(hitT)).sub(bubble.xyz).div(bubble.w)
          const bFacing = bNormal.dot(view).abs().clamp(0, 1)
          const bRim = smoothstep(0.05, 0.62, bFacing.oneMinus())
          const bGlint = smoothstep(0.84, 0.96, bNormal.dot(halfKey)).mul(3.2)
          const bCaustic = smoothstep(0.38, 0.9, bNormal.negate().dot(halfKey)).mul(1.45)
          const bFresnelRing = smoothstep(0.52, 0.88, bFacing.oneMinus()).mul(1.1)
          const bTint = exp(hitT.mul(vec3(-0.02, -0.06, -0.18)))
          bubbleLight.addAssign(vec3(1, 0.99, 0.96).mul(bGlint).add(vec3(1.1, 0.84, 0.3).mul(bCaustic.add(bFresnelRing))).mul(bTint))
          bubbleDim.mulAssign(float(1).sub(bRim.mul(0.92)))
        })
      })
    })
    const baseRadiance = paintColor.mul(covered).add(mediumGlow)
    const radiance = baseRadiance.mul(bubbleDim).add(bubbleLight)
    // Rich burnt-amber interior tames harsh background horizon splits while letting the refracted room glint through the crystal perimeter.
    const channelTransmittance = mix(float(0.1), float(0.46), viewRim.pow(2.2))
    const transmittance = covered.oneMinus().mul(channelTransmittance).mul(bubbleDim.mul(0.3).add(0.7))
    return {
      radiance,
      transmittance,
    }
  }
}
