import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_atan2, mx_noise_float, time, vec3} from 'three/tsl'

import {cosinePalette} from '../../lib/cosinePalette.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {starfield} from '../../lib/starfield.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A black hole shadow wrapped in a razor-thin glowing photon ring. Background stars smear through gravitational lensing. One side Doppler-shifts blue-white, the other red-orange. The ring moves with viewing angle. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.2)
    this.name = knotData.id
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
    // The photon ring is a thin bright band at a specific viewing angle
    // It shifts position as you orbit, always near the edge
    const ringPosition = 0.78
    const ringWidth = 0.03
    const ringField = grazing.sub(ringPosition).abs()
    const ring = ringField.smoothstep(ringWidth, ringWidth * 0.15)
    const ringCore = ringField.smoothstep(ringWidth * 0.4, ringWidth * 0.08)
    // Secondary Einstein ring — fainter, inner
    const ring2Position = 0.55
    const ring2Width = 0.015
    const ring2Field = grazing.sub(ring2Position).abs()
    const ring2 = ring2Field.smoothstep(ring2Width, ring2Width * 0.1)
    // Doppler shift — one side blue, other side red
    // Use the view direction's lateral component
    const dopplerAxis = vec3(0.8, 0.1, 0.6).normalize()
    const dopplerPhase = view.dot(dopplerAxis)
    const blueShift = dopplerPhase.clamp().pow(1.5)
    const redShift = dopplerPhase.negate().clamp().pow(1.5)
    // Accretion disk — thin luminous band near the equator
    const diskAxis = vec3(0.15, 0.97, 0.18).normalize()
    const diskAlignment = p.normalize().dot(diskAxis).abs()
    const diskThickness = 0.15
    const disk = diskAlignment.smoothstep(diskThickness, diskThickness * 0.3)
      .mul(grazing.smoothstep(0.3, 0.6))
    // Disk spiral structure
    const diskAngle = mx_atan2(p.x, p.z.add(0.0001)) as unknown as Node<'float'>
    const diskSpiral = diskAngle.mul(3).add(p.length().mul(8)).sub(time.mul(1.5)).sin()
      .mul(0.5).add(0.5)
    const diskDetail = diskSpiral.pow(2).mul(disk)
    // Gravitationally lensed background — stars smear and curve
    // Warp the lookup direction based on proximity to the "shadow" edge
    const lensStrength = grazing.smoothstep(0.5, 0.9).mul(2.5)
    const lensedDir = view.add(
      p.normalize().mul(lensStrength.mul(grazing.pow(2))),
    ).normalize()
    // Starfield visible through gravitational lensing
    const stars = starfield(lensedDir, 45, 0.65)
    const starsLensed = stars.mul(grazing.smoothstep(0.6, 0.85))
    // Star smearing — elongate stars near the shadow edge
    const smearDir = lensedDir.add(
      vec3(time.mul(0.005), 0, time.mul(-0.003)),
    )
    const smearStars = starfield(smearDir, 42, 0.7)
    const smear = smearStars.mul(grazing.smoothstep(0.7, 0.92)).mul(0.5)
    // Ring colors
    const blueRingColor = color(hsl.integer(256, 100, 79.6))
    const redRingColor = color(hsl.integer(39, 100, 65))
    const whiteCore = color(hsl.integer(85, 100, 98.4))
    const dopplerMix = blueShift.div(blueShift.add(redShift).max(0.001))
    const ringColor = mix(redRingColor, blueRingColor, dopplerMix)
    // Accretion disk color
    const diskColorInner = color(hsl.integer(85, 100, 90.4))
    const diskColorOuter = color(hsl.integer(49, 100, 70.6))
    const diskFinalColor = mix(diskColorOuter, diskColorInner, diskDetail)
    // Shadow — the event horizon swallows everything
    const shadow = facing.smoothstep(0.35, 0.15)
    // Base surface: absolute darkness
    this.colorNode = color(hsl.integer(0, 0, 0))
    this.metalness = 0
    this.roughness = 0
    // No reflections from the void
    this.clearcoat = 0
    this.envMapIntensity = 0
    // Hawking radiation — faint quantum glow at the very edge
    const hawkingGlow = grazing.smoothstep(0.88, 0.97).mul(grazing.smoothstep(0.99, 0.95))
    const hawkingColor = cosinePalette(
      time.mul(0.1).add(grazing.mul(3)),
      [0.5, 0.5, 0.5],
      [0.3, 0.3, 0.3],
      [1, 1, 1],
      [0, 0.15, 0.3],
    )
    // Time dilation visual — objects near the event horizon appear to freeze
    const timeDilation = facing.smoothstep(0.1, 0.3)
    const frozenLight = mx_noise_float(p.mul(30).add(vec3(time.mul(0.002), 0, 0)))
      .smoothstep(0.7, 0.75)
      .mul(timeDilation.oneMinus())
      .mul(intimate)
    // Combine all emission
    this.emissiveNode = ringColor.mul(ring).mul(3.5)
      .add(whiteCore.mul(ringCore).mul(2))
      .add(ringColor.mul(0.5).mul(ring2))
      .add(diskFinalColor.mul(disk).mul(near.mul(0.6).add(0.5)).mul(1.8))
      .add(starsLensed.mul(shadow.oneMinus()))
      .add(smear.mul(shadow.oneMinus()))
      .add(hawkingColor.mul(hawkingGlow).mul(intimate).mul(0.6))
      .add(color(hsl.integer(281, 100, 46.7)).mul(frozenLight).mul(0.2))
  }
}
