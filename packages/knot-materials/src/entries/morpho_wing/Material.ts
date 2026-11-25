import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, normalLocal, positionGeometry, transformNormalToView, vec2} from 'three/tsl'

import {lampFlash} from '../../candidates/space_bunny/lib/lampFlash.ts'
import {loopPhase} from '../../candidates/space_bunny/lib/loopClock.ts'
import {rotateAround} from '../../candidates/space_bunny/lib/rotateAround.ts'
import {surfaceFrame} from '../../candidates/space_bunny/lib/surfaceFrame.ts'
import {cellNoiseVec3 as cellNoise} from '../../lib/cellNoiseVec3.ts'
import {filteredRibbon} from '../../lib/filteredRibbon.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A butterfly wing scaled to the size of a monument. Every scale is a shallow tray of chitin with a fine ladder of ridges running across it, and that ladder is a diffraction grating: it only returns blue when your eye, the lamp and the ridge line up, so the colour migrates across the wing as you walk and the wing itself never changes. Ridges resolve only when they are wider than a pixel, so at a distance the whole wing calms down to the average of its own moiré. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.8)
    this.name = knotData.id
    const {p, view, grazing, near, intimate} = viewerFrame()
    const {tangent, bitangent} = surfaceFrame()
// Scales are laid on the surface itself: rows of overlapping trays in world units, so the tiling
// never pinches at the UV seam and stays the same size everywhere on the knot.
    const cellSize = 0.027
// The scales stand proud of the membrane, so they are read slightly in front of it.
    const scalePoint = positionGeometry.add(view.mul(0.006))
    const row = scalePoint.dot(tangent).div(cellSize)
    const column = scalePoint.dot(bitangent).div(cellSize)
    const cell = vec2(row, column).floor()
    const identity = cellNoise(cell)
    const centre = vec2(identity.x, identity.y).sub(0.5).mul(0.34)
    const local = vec2(row, column).fract().sub(0.5).sub(centre)
    const tray = local.length().sub(0.46).add(local.y.mul(0.12))
    const resolved = vec2(row, column).fwidth().length().smoothstep(0.22, 0.8).oneMinus()
    const present = identity.z.smoothstep(0.16, 0.26)
// The ridge ladder: fine ribs across every tray, the actual grating.
    const ribPhase = scalePoint.dot(bitangent).add(scalePoint.dot(tangent).mul(0.12)).mul(560)
    const ribs = filteredRibbon(ribPhase.sin(), 0.5).mul(resolved).mul(present)
    const veinRibs = filteredRibbon(scalePoint.dot(tangent).div(cellSize).mul(0.5).sin(), 0.06).mul(near.mul(0.6).add(0.4))
// Each tray is tilted by its own amount about the ridge axis; that tilt is the whole trick.
    const tilt = identity.x.sub(0.5).mul(1.5).add(mx_noise_float(p.mul(0.9)).mul(0.55)).add(loopPhase.sin().mul(0.1))
    const grating = rotateAround(normalLocal, tangent, tilt)
    const flash = lampFlash(transformNormalToView(grating).normalize(), 17).mul(present).mul(resolved.mul(0.55).add(0.45))
    const flashFine = lampFlash(transformNormalToView(rotateAround(grating, bitangent, ribs.mul(0.35))).normalize(), 70).mul(present).mul(ribs)
// Thickness decides which end of the interference the wing lands on.
    const thickness = mx_fractal_noise_float(p.mul(2.6), 3, 2.1, 0.55).mul(0.5).add(0.5)
    const royal = color(hsl.integer(266, 100, 42))
    const azure = color(hsl.integer(243, 99.9, 66))
    const violet = color(hsl.integer(289, 100, 50))
    const jade = color(hsl.integer(166, 95.7, 82.5))
    const interference = mix(royal, azure, thickness.smoothstep(0.34, 0.56))
    const hueShift = mix(interference, violet, thickness.smoothstep(0.56, 0.76))
    const structural = mix(hueShift, jade, thickness.smoothstep(0.82, 0.95))
    const chitin = mix(color(hsl.integer(278, 23, 6)), color(hsl.integer(302, 28, 17)), mx_noise_float(p.mul(5.5)).mul(0.5).add(0.5))
    const ground = mix(chitin, color(hsl.integer(85, 42, 91.6)), identity.z.smoothstep(0.1, 0.2).oneMinus().mul(veinRibs.mul(0.5)).mul(0.25))
    this.colorNode = mix(ground, mix(color(hsl.integer(273, 25, 4)), structural.mul(0.62), present), tray.smoothstep(0.02, 0.1))
    this.metalness = 0
    this.roughnessNode = float(0.24).add(tray.smoothstep(0.1, 0.3).mul(0.2)).sub(present.mul(0.06)).clamp(0.1, 0.6)
    this.ior = 1.55
    this.clearcoat = 0.7
    this.clearcoatRoughnessNode = float(0.09).add(ribs.mul(0.12)).clamp(0.04, 0.4)
    this.clearcoatNormalNode = proceduralNormal(ribs.mul(0.5).mul(near), 0.0004)
    this.normalNode = proceduralNormal(tray.mul(0.5).add(ribs.mul(near).mul(0.4)).add(veinRibs.mul(0.2)), 0.0045)
    const dust = mx_noise_float(p.mul(180)).mul(0.5).add(0.5).mul(near)
    this.emissiveNode = structural.mul(flash.mul(2.7))
      .add(structural.mul(flashFine).mul(0.9))
      .add(color(hsl.integer(250, 100, 90)).mul(grazing.pow(3.5)).mul(0.09))
      .add(color(hsl.integer(78, 100, 93.4)).mul(dust.mul(present.oneMinus())).mul(intimate).mul(0.12))
  }
}
