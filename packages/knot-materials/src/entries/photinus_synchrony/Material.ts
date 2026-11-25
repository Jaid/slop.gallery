import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_cell_noise_float, mx_noise_float, normalLocal, positionGeometry, time, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A dark amber-bark surface embedded with thousands of tiny firefly points. At distance they flash chaotically. As the viewer approaches, the fireflies synchronize into traveling waves — the Kuramoto model made visible. Glancing angles reveal micro-glints from each light organ. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.5)
    this.name = knotData.id
    const {p, grazing, near, intimate, objectDistance} = viewerFrame()
    // Bark substrate — rough wood/amber surface
    const barkCoarse = mx_noise_float(p.mul(5)).mul(0.5).add(0.5)
    const barkFine = mx_noise_float(p.mul(22)).mul(0.5).add(0.5)
    const barkGrain = mx_noise_float(p.mul(vec3(3, 45, 3))).mul(0.5).add(0.5)
    // Firefly placement — cellular grid with random centers
    const fireflyScale = 32
    const ffCoord = p.mul(fireflyScale)
    const ffCell = ffCoord.floor()
    const ffRnd = cellNoiseVec3(ffCell)
    const ffRnd2 = cellNoiseVec3(ffCell.add(47.3))
    const ffCenter = ffRnd.mul(0.5).add(0.25)
    const ffDist = ffCoord.fract().sub(ffCenter).length()
    const ffFw = ffCoord.fwidth().length().max(0.001)
    // Firefly body (tiny bright dot)
    const ffRadius = float(0.08).add(ffRnd2.x.mul(0.04))
    const ffBody = ffDist.smoothstep(ffRadius, ffFw.add(ffRadius))
      .oneMinus()
      .mul(ffFw.smoothstep(0.15, 0.45).oneMinus())
    // Activation gate — not all cells have fireflies
    const ffActive = mx_cell_noise_float(ffCell).smoothstep(0.35, 0.4)
    // Synchronization model:
    // Each firefly has a natural frequency. Near the viewer, coupling strength increases,
    // pulling them toward a shared phase → traveling synchrony wave.
    const naturalFreq = ffRnd.x.mul(1.5).add(1.8) // 1.8–3.3 Hz range
    const naturalPhase = ffRnd.y.mul(Math.PI * 2)
    // Coupling strength increases with proximity
    const coupling = objectDistance.smoothstep(4.5, 1.2).clamp()
    // Global wave that provides the synchronized target phase
    const waveDirection = vec3(0.6, 0.3, 0.74).normalize()
    const globalWave = p.dot(waveDirection).mul(4).sub(time.mul(2.5))
    // Individual phase interpolates between chaotic and synchronized
    const chaoticPhase = time.mul(naturalFreq).add(naturalPhase)
    const syncPhase = globalWave.add(ffRnd.z.mul(0.4)) // slight individual offset
    const phase = mix(chaoticPhase, syncPhase, coupling)
    // Flash envelope — brief bright flash, longer dark period
    const flashRaw = phase.sin().mul(0.5).add(0.5)
    const flash = flashRaw.pow(6) // sharp flash envelope
    const glow = flashRaw.pow(2).mul(0.15) // soft afterglow
    // Firefly emission
    const fireflyLight = ffBody.mul(ffActive).mul(flash.add(glow))
    // Halo around each firefly
    const haloRadius = float(0.22)
    const halo = ffDist.smoothstep(haloRadius.add(ffFw.mul(2)), ffFw.mul(0.5))
      .mul(ffActive)
      .mul(flash)
      .mul(ffFw.smoothstep(0.25, 0.7).oneMinus())
      .mul(0.15)
    // Color temperature varies per firefly — warm yellow to cool green
    const ffTempPhase = ffRnd2.y
    const warmFirefly = color(hsl.integer(95, 100, 89.5))
    const coolFirefly = color(hsl.integer(136.7, 100, 87.9))
    const fireflyColor = mix(warmFirefly, coolFirefly, ffTempPhase)
    // Bark surface colors
    const darkBark = color(hsl.integer(54, 39, 8))
    const midBark = color(hsl.integer(57, 45, 13))
    const lightBark = color(hsl.integer(61, 48, 20))
    const barkColor = mix(darkBark, mix(midBark, lightBark, barkGrain), barkCoarse.mul(0.5))
    // Moss patches on the bark
    const mossField = mx_noise_float(p.mul(8).add(3.7)).mul(0.5).add(0.5)
    const moss = mossField.smoothstep(0.62, 0.78)
    const mossColor = mix(color(hsl.integer(134, 61, 15)), color(hsl.integer(134, 63, 10)), barkFine)
    this.colorNode = mix(barkColor, mossColor, moss.mul(0.6))
    this.metalness = 0
    this.roughnessNode = float(0.85).sub(moss.mul(0.15)).clamp(0.6, 0.92)
    // Slight sheen for moss
    this.sheen = 0.15
    this.sheenColor.set(hsl.integer(137, 83, 28))
    this.sheenRoughness = 0.7
    // Bark normal texture
    const barkHeight = barkCoarse.mul(0.5).add(barkFine.mul(0.3)).add(barkGrain.mul(0.2))
    this.normalNode = proceduralNormal(barkHeight, 0.0012)
    // Bark displacement
    const barkDisp = barkCoarse.mul(0.008).sub(0.004).add(moss.mul(0.002))
    this.positionNode = positionGeometry.add(normalLocal.mul(barkDisp))
    // Emissive — the fireflies!
    // Primary flash emission
    const primaryEmission = fireflyColor.mul(fireflyLight).mul(3.5)
    // Soft halo emission
    const haloEmission = fireflyColor.mul(halo)
    // Ambient bioluminescence from moss when very close
    const mossGlow = moss.mul(intimate).mul(0.04)
    // View-dependent glint on firefly bodies at grazing angles
    const ffGlint = ffBody.mul(ffActive).mul(grazing.pow(3)).mul(flash).mul(near)
    this.emissiveNode = primaryEmission
      .add(haloEmission)
      .add(color(hsl.integer(150.7, 100, 86.4)).mul(mossGlow))
      .add(color(hsl.integer(0, 0, 100)).mul(ffGlint).mul(2))
  }
}
