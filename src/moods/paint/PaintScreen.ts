import type {MoodScreen} from '../base/Mood.ts'
import type {Node} from 'three/webgpu'

import {atan, colorSpaceToWorking, exp, float, If, Loop, max, mix, mx_noise_float, screenSize, screenUV, smoothstep, uniformArray, vec2, vec3, vec4, workingToColorSpace} from 'three/tsl'
import {SRGBColorSpace, Vector4} from 'three/webgpu'

import {paintColor} from '#src/lib/materials/oilPaints.ts'

import {vignetteStrokes} from './strokes.ts'

type Float = Node<'float'>

/** how many bristle bundles run across a brush stroke */
const grooves = 7.5
/** impasto ridge tilt so bristles catch light like thick oil paint without dark plastic creases */
const relief = 0.13
const anchorCenterArray = uniformArray(vignetteStrokes.map(({anchor, center}) => new Vector4(anchor[0], anchor[1], center[0], center[1])), 'vec4').setName('paintVignetteCenters') as unknown as {element: (at: Node<'int'>) => Node<'vec4'>}
const geometryArray = uniformArray(vignetteStrokes.map(({halfWidth, radius, startAngle, sweep}) => new Vector4(radius, startAngle, sweep, halfWidth)), 'vec4').setName('paintVignetteGeometry') as unknown as {element: (at: Node<'int'>) => Node<'vec4'>}
const timingArray = uniformArray(vignetteStrokes.map(({delay, duration, phase, repaintPeriod}) => new Vector4(delay, duration, repaintPeriod, phase)), 'vec4').setName('paintVignetteTiming') as unknown as {element: (at: Node<'int'>) => Node<'vec4'>}
const pigmentArray = uniformArray(vignetteStrokes.map(({paint}) => new Vector4(paint[0], paint[1], 0, 0)), 'vec4').setName('paintVignettePigments') as unknown as {element: (at: Node<'int'>) => Node<'vec4'>}

/**
 * The Paint Orb’s screen vignette: a subtle warm-umber edge wash with twenty curved oil strokes painted sequentially across all four corners and outer borders, with split-bristle tips, rich opaque oil pigment streaked with a second color, advancing wet beads, gentle impasto sheen and four corner accents that periodically repaint themselves while the mood holds.
 */
export const paintScreen: MoodScreen = (frame, {age, amount}) => {
  const aspect = screenSize.x.div(max(screenSize.y, 1))
  const px = float(1).div(max(screenSize.y, 1))
  const baseLinear = colorSpaceToWorking(vec4(frame.rgb.max(0), 1), SRGBColorSpace).rgb
  // Soft warm-umber edge vignette wash so bright walls stay framed and the center remains clear.
  const edgeOffset = screenUV.sub(0.5).mul(2).abs()
  const cornerDistance = edgeOffset.x.pow2().add(edgeOffset.y.pow2()).mul(0.5).sqrt()
  const wash = smoothstep(0.48, 1.05, cornerDistance).mul(amount)
  const canvas = baseLinear.mul(mix(vec3(1), vec3(0.75, 0.71, 0.66), wash)).toVar('paintVignetteCanvas')
  // Strokes reach rich opacity early while the 4 s mood fade brings them in, and fade smoothly to 0 over the 0.25 s release.
  const strokePresence = amount.pow(0.4)
  // Upper-left studio light in screen space (-y is up in screenUV), drifting gently so wet oil shimmers as time runs.
  const lightDir = vec3(age.mul(0.45).sin().mul(0.08).sub(0.45), age.mul(0.35).cos().mul(0.05).sub(0.75), 0.55).normalize()
  const halfway = lightDir.add(vec3(0, 0, 1)).normalize()
  Loop(vignetteStrokes.length, ({i}) => {
    const timing = timingArray.element(i)
    const [delay, duration, repaintPeriod, phase] = [timing.x, timing.y, timing.z, timing.w]
    const tSince = age.sub(delay)
    const laid = float(0).toVar('paintStrokeLaid')
    const strokeFade = float(1).toVar('paintStrokeFade')
    const cyclePhase = phase.toVar('paintStrokePhase')
    If(tSince.greaterThan(0), () => {
      If(repaintPeriod.greaterThan(0), () => {
        const cycle = tSince.div(repaintPeriod).floor()
        const localTime = tSince.sub(cycle.mul(repaintPeriod))
        laid.assign(smoothstep(0, duration, localTime))
        strokeFade.assign(float(1).sub(smoothstep(repaintPeriod.sub(1), repaintPeriod, localTime)))
        cyclePhase.assign(phase.add(cycle.mul(0.37)).fract())
      }).Else(() => {
        laid.assign(smoothstep(0, duration, tSince))
      })
    })
    If(laid.greaterThan(0).and(strokeFade.greaterThan(0)), () => {
      const anchorCenter = anchorCenterArray.element(i)
      const geometry = geometryArray.element(i)
      const [anchor, center] = [anchorCenter.xy, anchorCenter.zw]
      const [radius, startAngle, sweep, halfWidth] = [geometry.x, geometry.y, geometry.z, geometry.w]
      const rel = screenUV.sub(anchor).mul(vec2(aspect, 1))
      const toPixel = rel.sub(center)
      const dist = toPixel.length()
      const radial = dist.sub(radius)
      If(radial.abs().lessThan(halfWidth.mul(1.7)), () => {
        const midAngle = startAngle.add(sweep.mul(0.5))
        const pixelAngle = atan(toPixel.y, toPixel.x)
        const angleDiff = pixelAngle.sub(midAngle)
        const deltaMid = atan(angleDiff.sin(), angleDiff.cos())
        const tRaw = deltaMid.div(sweep).add(0.5)
        const tClamped = tRaw.clamp(0, 1)
        const arcLen = radius.mul(sweep.abs())
        const along = tRaw.mul(arcLen)
        const headEnd = laid.mul(arcLen)
        const alongN = along.div(halfWidth)
        // Organic hand-painted path wobble so strokes bend naturally rather than like compass arcs.
        const wobble = mx_noise_float(vec3(alongN.mul(0.35), cyclePhase.mul(13), 1.7)).mul(halfWidth.mul(0.2))
        const wobbledRadial = radial.add(wobble)
        // Tapered at start and tail, ramping pressure gently as the brush first touches down.
        const startRamp = smoothstep(0, 0.16, laid)
        const half = halfWidth.mul(startRamp).mul(mix(float(0.5), float(1), smoothstep(0, 0.22, tClamped))).mul(mix(float(1), float(0.45), smoothstep(0.55, 1, tClamped))).mul(tClamped.mul(6).add(cyclePhase.mul(30)).sin().mul(0.06).add(1))
        const across = wobbledRadial.div(half)
        If(across.abs().lessThan(1.45).and(along.greaterThan(half.mul(-1.2))).and(along.lessThan(headEnd.add(half.mul(1.2)))), () => {
          const headN = headEnd.div(halfWidth)
          const halfN = half.div(halfWidth)
          // Long continuous bristle strands along the stroke (slowly changing along length so bristles never stipple).
          const bristlesAt = (crosswise: Float, lengthways: Float) => mx_noise_float(vec3(crosswise.mul(grooves * 0.55), lengthways.mul(0.14), cyclePhase.mul(17))).mul(0.35).add(mx_noise_float(vec3(crosswise.mul(grooves), lengthways.mul(0.28), cyclePhase.mul(31))).mul(0.18)).add(0.5).clamp(0.02, 1)
          const pushing = float(1).sub(laid.pow(5))
          const heightAt = (crosswise: Float, lengthways: Float) => {
            const rounded = float(1).sub(crosswise.mul(crosswise)).max(0).sqrt().mul(0.65)
            const ridges = exp(crosswise.abs().sub(0.85).div(0.12).pow2().negate()).mul(0.32)
            const load = mix(float(1), float(0.46), tClamped)
            const bead = exp(headN.sub(lengthways).div(halfN.mul(0.8)).pow2().negate()).mul(0.48).mul(pushing)
            return rounded.add(ridges).mul(load).add(bristlesAt(crosswise, lengthways).sub(0.5).mul(0.48)).add(bead)
          }
          const surface = heightAt(across, alongN)
          const slopeAcross = heightAt(across.add(0.05), alongN).sub(surface).div(0.05)
          const slopeAlong = heightAt(across, alongN.add(0.06)).sub(surface).div(0.06)
          const localFacing = vec3(slopeAcross.mul(-relief), slopeAlong.mul(-relief), 1).normalize()
          const radialDir = toPixel.div(max(dist, 1e-4))
          const tangentDir = vec2(radialDir.y.negate(), radialDir.x).mul(sweep.sign())
          const screenNormal = vec3(radialDir.mul(localFacing.x).add(tangentDir.mul(localFacing.y)), localFacing.z).normalize()
          const bristle = bristlesAt(across, alongN)
          // Frayed individual bristle fingers at both start and advancing head from smooth noise along bristles (no sawtooth serrations).
          const tipSplit = bristle.sub(0.5).mul(half.mul(1.35))
          const ragged = mx_noise_float(vec3(alongN.mul(0.75), across.sign().mul(2.5), cyclePhase.mul(13))).mul(0.15)
          const edges = ragged.add(1).sub(across.abs()).mul(half)
          const crown = float(1).sub(across.mul(across)).max(0)
          const startCap = along.add(tipSplit).add(half.mul(0.35).mul(crown))
          const headCap = headEnd.sub(along).add(tipSplit).add(half.mul(0.3).mul(crown))
          const inside = edges.min(startCap).min(headCap)
          const coverage = smoothstep(px.mul(-1.5), px.mul(1.5), inside)
          const edgeShadow = smoothstep(px.mul(-4), px.mul(1.5), inside).mul(0.14)
          // Longitudinal dry-brush streaks splitting along the outer fringes and tail.
          const dry = smoothstep(0.64, 1, tClamped).mul(0.55).add(smoothstep(0.72, 1.04, across.abs()).mul(0.48)).sub(0.2)
          const streaks = smoothstep(dry.sub(0.1), dry.add(0.1), bristle)
          const visibility = streaks.mul(strokeFade).mul(strokePresence).mul(startRamp)
          const alpha = coverage.mul(visibility).mul(0.95)
          // Rich two-tone oil pigment streaked along the bristles.
          const pigments = pigmentArray.element(i)
          const dipped = smoothstep(-0.3, 0.55, across.add(mx_noise_float(vec3(alongN.mul(0.3), cyclePhase.mul(7), 0)).mul(0.4)))
          const second = smoothstep(0.34, 0.64, bristlesAt(across.mul(0.75).add(3.1), alongN.mul(0.4))).mul(dipped).mul(0.88)
          const tone = mx_noise_float(vec3(alongN.mul(0.28), across.mul(0.6), cyclePhase.mul(23))).mul(0.1).add(0.98)
          const pigment = mix(paintColor(pigments.x), paintColor(pigments.y), second).mul(tone)
          const lit = max(screenNormal.dot(lightDir), 0).mul(0.35).add(0.74)
          const specularDot = max(screenNormal.dot(halfway), 0)
          const gloss = specularDot.pow(28).mul(0.18).add(specularDot.pow(8).mul(0.04))
          const shaded = pigment.mul(lit).add(vec3(gloss))
          canvas.assign(canvas.mul(float(1).sub(edgeShadow.mul(visibility))))
          canvas.assign(mix(canvas, shaded, alpha))
        })
      })
    })
  })
  return vec4(workingToColorSpace(vec4(canvas.max(0), 1), SRGBColorSpace).rgb, frame.a)
}
