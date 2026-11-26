import type {Node} from 'three/webgpu'

import hsl from 'okhsl'
import {atan, exp, float, If, max, min, mix, mx_cell_noise_float, mx_noise_float, screenSize, screenUV, sin, smoothstep, vec2, vec3} from 'three/tsl'

import MoodScreen from '../base/MoodScreen.ts'

/** Display-space ice colors for soft frosted windowpane glass and feathery corner hoarfrost. */
const toDisplay = (hex: number) => vec3(hex >> 16, hex >> 8 & 255, hex & 255).div(255)
const frostMist = toDisplay(hsl.integer(224, 42, 74))
const frostCyan = toDisplay(hsl.integer(218, 56, 84))
const rimeWhite = toDisplay(hsl.integer(214, 24, 96))
const glintWhite = toDisplay(hsl.integer(208, 45, 100))
/**
 * Soft, feathery frost-fern clusters embedded inside the milky frozen glass condensation of each corner (never harsh spiderweb hairs).
 */
function featheryFrost(p: Node<'vec2'>, corner: Node<'float'>, radialDist: Node<'float'>, angle: Node<'float'>) {
  const drift = mx_noise_float(vec2(radialDist.mul(5.5), angle.mul(2.2).add(corner.mul(3.1)))).mul(0.24)
  const sector = angle.add(drift).mul(6.5).add(corner.mul(2.3))
  const cell = sector.floor()
  const local = sector.fract().sub(0.5)
  const tipReach = mx_cell_noise_float(vec3(cell, corner, 1.7)).mul(0.11).add(0.15)
  const alongT = radialDist.div(tipReach).clamp(0, 1)
  // Soft, powdery frost feather rather than a thin white wire.
  const featherWidth = mix(float(0.38), float(0.12), alongT)
  const chevron = radialDist.mul(34).sub(local.abs().mul(11)).fract().sub(0.5).abs()
  const barb = smoothstep(0.34, 0.06, chevron).mul(smoothstep(featherWidth, 0.02, local.abs()))
  const body = smoothstep(featherWidth.mul(0.75), 0, local.abs()).mul(0.55)
  const grain = mx_noise_float(p.mul(130).add(corner.mul(4.1))).mul(0.4).add(0.6)
  return max(body, barb).mul(grain).mul(smoothstep(tipReach, tipReach.sub(0.11), radialDist))
}

/**
 * Windowpane hoarfrost creeping organically inward from the four corners of the view: a soft, translucent milky frosted-glass condensation haze layered with feathery crystalline frost clusters and tiny pinpoint ice sparkles, keeping the entire center and room silhouettes clear.
 */
export default class FrostScreen extends MoodScreen {
  constructor(private readonly arrivalTime: number) {
    super()
  }

  draw(frame: Node<'vec3'>): Node<'vec3'> {
    const short = min(screenSize.x, screenSize.y)
    const p = min(screenUV, screenUV.oneMinus()).mul(screenSize).div(short).toVar()
    const cornerDist = p.length()
    const result = frame.toVar()
    // Soft corner-anchored frozen glass fans — leaves the entire center and side walls open.
    If(cornerDist.lessThan(0.36), () => {
      const corner = screenUV.x.step(0.5).add(screenUV.y.step(0.5).mul(2))
      const clock = this.arrival.mul(this.arrivalTime).add(this.stay)
      const angle = atan(p.y, p.x)
      // Organic multi-scale frosted-glass condensation veil (soft milky rime clouds clinging to the glass corners).
      const cloud1 = mx_noise_float(p.mul(9).add(corner.mul(3.7))).mul(0.5).add(0.5)
      const cloud2 = mx_noise_float(p.mul(26).add(corner.mul(7.1))).mul(0.5).add(0.5)
      const microGrain = mx_noise_float(p.mul(190).add(corner.mul(11.3))).mul(0.5).add(0.5)
      const cloud = cloud1.mul(0.55).add(cloud2.mul(0.32)).add(microGrain.mul(0.13))
      // Soft feathered frost-fern texture nestled within the condensation haze.
      const fern = featheryFrost(p, corner, cornerDist, angle)
      // Organic radial reach modulated by the frost clouds and ferns so it melts smoothly into clear glass.
      const reach = cornerDist.div(0.3).sub(cloud.mul(0.28)).sub(fern.mul(0.22))
      const progress = this.arrival.smoothstep(0, 1).mul(this.presence.smoothstep(0, 1))
      const frontier = progress.mul(1.04).sub(reach)
      const frostMask = smoothstep(-0.08, 0.24, frontier)
      // Delicate shimmering crystalline edge along the growing frost frontier during arrival.
      const frontGlow = smoothstep(0.08, 0, frontier.sub(0.02).abs()).mul(this.arrival.lessThan(0.995).select(float(0.65), float(0.12))).mul(this.presence)
      // Tiny circular sub-pixel pinpoint crystal sparkles embedded inside the frozen glass.
      const sparkGrid = p.mul(72)
      const sparkCell = sparkGrid.floor()
      const sparkOffset = vec2(mx_cell_noise_float(vec3(sparkCell, corner.add(1.1))), mx_cell_noise_float(vec3(sparkCell, corner.add(5.7)))).mul(0.6).add(0.2)
      const sparkDist = sparkGrid.fract().sub(sparkOffset).length()
      const sparkPhase = mx_cell_noise_float(vec3(sparkCell, corner.add(9.3)))
      const sparkPulse = sin(clock.mul(3).add(sparkPhase.mul(45))).mul(0.5).add(0.5).pow(14)
      const sparkle = exp(sparkDist.mul(sparkDist).mul(-80)).mul(sparkPulse).mul(frostMask)
      // Milky frosted glass appearance: desaturates & softens the chilled background under a luminous icy rime veil.
      const luma = frame.r.mul(0.299).add(frame.g.mul(0.587)).add(frame.b.mul(0.114))
      const chilled = mix(frame, vec3(luma).mul(vec3(0.84, 0.93, 1.06)), float(0.65))
      const milky = mix(chilled, frostMist, float(0.38).add(cloud.mul(0.24)))
      const crystallized = mix(milky, mix(frostCyan, rimeWhite, microGrain.mul(0.5).add(0.5)), fern.mul(0.58).add(smoothstep(0.16, 0, cornerDist).mul(0.35)).clamp(0, 0.85))
      const lit = crystallized.add(glintWhite.mul(sparkle.mul(0.95).add(frontGlow.mul(0.3))))
      const guard = smoothstep(0.36, 0.24, cornerDist)
      const cornerFalloff = smoothstep(0.34, 0.02, cornerDist)
      const opacity = frostMask.mul(cornerFalloff.mul(0.62).add(fern.mul(0.28))).clamp(0, 0.72).mul(guard)
      result.assign(mix(frame, lit, opacity))
    })
    return result
  }
}
