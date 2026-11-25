import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, mx_worley_noise_vec3, normalLocal, transformNormalToView, vec3} from 'three/tsl'

import {lampFlash} from '../../candidates/space_bunny/lib/lampFlash.ts'
import {loopPhase} from '../../candidates/space_bunny/lib/loopClock.ts'
import {microGlitter} from '../../candidates/space_bunny/lib/microGlitter.ts'
import {rotateAround} from '../../candidates/space_bunny/lib/rotateAround.ts'
import {surfaceFrame} from '../../candidates/space_bunny/lib/surfaceFrame.ts'
import {filament} from '../../lib/filament.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Labradorite, cut and polished until the sky is only a rumour. Feldspar platelets hang in sheets below the surface; every one of them is a tiny tilted mirror, so the fire only ignites where the reflected lamp happens to line up with your eye. Walk past it and the peacock bands chase you across the stone, because the flash is a lobe around a normal that is still there when you move. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.8)
    this.name = knotData.id
    const {p, view, grazing, near, intimate} = viewerFrame()
// The host rock: dark anorthosite, coarse grain, scattered mafic flecks and hairline seams.
    const grain = mx_fractal_noise_float(p.mul(5.6), 4, 2.14, 0.5)
    const warpGrain = mx_noise_float(p.mul(2.2)).mul(0.012)
    const cells = mx_worley_noise_vec3(p.mul(34), 1, 0)
    const fleck = cells.x.smoothstep(0.04, 0.19).oneMinus()
    const needles = filament(cells.y.sub(cells.x).add(warpGrain), 0.006).mul(near)
    const seam = cells.y.sub(cells.x).abs().smoothstep(0, 0.05).oneMinus()
// The platelets hang three centimetres under the polish, so they are sampled along the view ray:
// the fire you see has slid sideways inside the stone, not across its face.
    const under = p.sub(view.mul(0.03))
// Exsolution sheets: a swirl field tilts the platelet mirror away from the polish, slowly and by a lot.
    const swirlX = mx_noise_float(under.mul(1.15).add(vec3(4.2, 1.1, -2.7)))
    const swirlY = mx_noise_float(under.mul(1.15).add(vec3(-3.4, 2.2, 5.6)))
    const {tangent, bitangent} = surfaceFrame()
    const axis = normalLocal.add(tangent.mul(swirlX.mul(0.85))).add(bitangent.mul(swirlY.mul(0.85))).normalize()
    const tilt = mx_noise_float(under.mul(1.9).add(vec3(1.7, -3.2, 0.9))).mul(2.7).add(loopPhase.sin().mul(0.07))
    const lamella = rotateAround(normalLocal, axis, tilt)
    const lamellaView = transformNormalToView(lamella).normalize()
// Platelet thickness picks the colour of the fire; the second, finer sheet only wakes up close by.
    const warp = mx_fractal_noise_float(under.mul(2.6).add(vec3(7.1, -2.3, 4.8)), 3, 2.05, 0.5)
    const thickness = under.dot(vec3(0.41, -0.27, 0.87)).mul(19).add(warp.mul(7)).sin().mul(0.5).add(0.5)
    const zone = mx_noise_float(p.mul(1.15).add(vec3(-2.7, 5.2, 1.4))).mul(0.5).add(0.5).smoothstep(0.42, 0.72)
    const flash = lampFlash(lamellaView, 16).mul(zone)
    const fine = rotateAround(lamella, axis, mx_noise_float(under.mul(8.5)).mul(1.1))
    const fineFlash = lampFlash(transformNormalToView(fine).normalize(), 34).mul(near).mul(zone)
    const peacock = color(hsl.integer(184, 97, 76))
    const cobalt = color(hsl.integer(264, 100, 51))
    const amethyst = color(hsl.integer(301, 87, 48))
    const bronze = color(hsl.integer(75.6, 100, 79.7))
    const interference = mix(peacock, cobalt, thickness.smoothstep(0.22, 0.56))
    const violet = mix(interference, amethyst, thickness.smoothstep(0.5, 0.72))
    const fire = mix(violet, bronze, thickness.smoothstep(0.68, 0.94))
    const mica = microGlitter(p, 0.026, 150, 0.45)
    const stone = mix(color(hsl.integer(261, 17, 8)), color(hsl.integer(257, 17, 22)), grain.mul(0.5).add(0.5))
    const ground = mix(mix(stone, color(hsl.integer(255, 16, 39)), fleck.mul(0.6)), color(hsl.integer(264, 15, 6)), needles.mul(0.7)).mul(seam.mul(0.35).oneMinus().mul(0.4).add(0.6))
    this.colorNode = ground
    this.metalness = 0
    this.ior = 1.56
    this.roughnessNode = float(0.24).add(grain.mul(0.06)).add(fleck.mul(0.32)).sub(flash.mul(0.06)).clamp(0.06, 0.62)
    this.clearcoat = 0.5
    this.clearcoatRoughnessNode = float(0.1).add(grain.mul(0.04)).sub(flash.mul(0.05)).clamp(0.03, 0.4)
    this.normalNode = proceduralNormal(grain.mul(0.3).add(fleck.mul(0.95)).sub(needles.mul(0.4)).add(mx_noise_float(vec3(p.x.mul(96), p.y.mul(7), p.z.mul(96))).mul(near).mul(0.3)), 0.0022)
    this.emissiveNode = fire.mul(flash.mul(2.6))
      .add(fire.mul(fineFlash).mul(intimate.mul(0.7).add(0.3)).mul(0.7))
      .add(peacock.mul(grazing.pow(3.4)).mul(0.1))
      .add(color(hsl.integer(81, 100, 96.3)).mul(mica.sparkle).mul(intimate).mul(0.9))
      .add(color(hsl.integer(228, 67, 23)).mul(fleck.mul(0.6)).mul(0.06))
  }
}
