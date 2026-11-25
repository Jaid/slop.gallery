import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, mx_noise_float, mx_worley_noise_vec3, normalViewGeometry, vec3} from 'three/tsl'

import {lampFlash} from '../../candidates/space_bunny/lib/lampFlash.ts'
import {loopPhase} from '../../candidates/space_bunny/lib/loopClock.ts'
import {microGlitter} from '../../candidates/space_bunny/lib/microGlitter.ts'
import {filament} from '../../lib/filament.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Ice with weather in it. The body is milky with the crushed bubbles of every winter that fed it, and the ancient air is still inside, drawn out into long lenses along two different flow lines. Crevasses are the only place the light gets anywhere: they go blue-black at the bottom and their lip is cut at an angle that catches the lamps from one side only, so leaning left or right decides how hard the crack glitters. Frost blooms only where the air is dry, which at this temperature means only close enough to breathe on it. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.55)
    this.name = knotData.id
    const {p, view, grazing, near, intimate} = viewerFrame()
// The glacier body: milky blue with a slow cloudiness, and strain bands from the years it leaned.
    const cloud = mx_fractal_noise_float(p.mul(3.2), 4, 2.08, 0.55).mul(0.5).add(0.5)
    const strain = mx_fractal_noise_float(p.mul(6.5).add(cloud.mul(1.4)), 3, 2.1, 0.5).mul(0.5).add(0.5)
// Trapped air, drawn out into lenses along two flow directions and clustered into clouds. It is
// under the surface, so it is found by walking the view ray into the ice rather than reading a map.
    const inside = p.sub(view.mul(0.05))
    const lensA = mx_worley_noise_vec3(inside.mul(vec3(40, 11, 40)), 1, 0).x
    const lensB = mx_worley_noise_vec3(inside.mul(vec3(13, 34, 13)).add(vec3(3.7, 1.2, -2.6)), 1, 0).x
    const lensGate = mx_noise_float(inside.mul(3.4)).smoothstep(0.3, 0.62)
    const lens = mix(lensA, lensB, lensGate)
    const cloudGate = mx_noise_float(inside.mul(4.2).add(vec3(2.2, -1.1, 0.7))).smoothstep(0.28, 0.58)
    const bubble = lens.smoothstep(0.07, 0.19).oneMinus().mul(cloudGate).mul(near.mul(0.85).add(0.15))
    const bubbleRim = lens.smoothstep(0.19, 0.26).oneMinus().mul(cloudGate).mul(near)
// Crevasses: warped ridge fields at two scales, opened where the strain runs highest.
    const warp = mx_fractal_noise_float(p.mul(2.6).add(vec3(4.4, -1.2, 2.8)), 3, 2.05, 0.5)
    const crevasseField = mx_noise_float(p.mul(6.8).add(warp.mul(1.1)).add(vec3(1.2, 3.4, -2.2)))
    const hairlineField = mx_noise_float(p.mul(17).add(warp.mul(1.6)).add(vec3(-4.1, 0.9, 2.2)))
    const opened = strain.smoothstep(0.42, 0.7).mul(0.75).add(0.25)
    const crevasse = filament(crevasseField, 0.016).mul(opened)
    const crevasseDeep = crevasse.smoothstep(0.35, 0.95)
    const hairline = filament(hairlineField, 0.008).mul(opened).mul(near.mul(0.5).add(0.5))
// The cut lip only exists on the side you happen to be standing on.
    const shifted = filament(mx_noise_float(p.sub(view.mul(0.022)).mul(6.8).add(warp.mul(1.1)).add(vec3(1.2, 3.4, -2.2))), 0.016)
    const lip = shifted.sub(crevasse)
// Hoarfrost: fern crystals along the cell walls, only in dry, cold, close air.
    const frostCells = mx_worley_noise_vec3(p.mul(150), 1, 0)
    const frostEdge = frostCells.y.sub(frostCells.x).abs().smoothstep(0, 0.016).oneMinus()
    const frost = frostEdge.mul(mx_noise_float(p.mul(5.5)).smoothstep(0.1, 0.38)).mul(near.mul(0.9).add(0.1))
    const sparkle = microGlitter(inside, 0.016, 120, 0.5)
// The cold light inside the ice turns slowly, the way light does under a thick sky.
    const glimmer = loopPhase.sin().mul(0.5).add(0.5).mul(loopPhase.mul(3).sin().mul(0.5).add(0.5))
    const ice = mix(color(hsl.integer(237, 38, 61)), color(hsl.integer(244, 61, 35)), cloud)
    const crevasseBody = mix(ice, color(hsl.integer(248, 63, 11)), crevasseDeep.mul(0.95))
    this.colorNode = mix(mix(crevasseBody, color(hsl.integer(241, 65, 17)), hairline.mul(0.7)), color(hsl.integer(238, 100, 96)), bubble.mul(0.85).add(bubbleRim.mul(0.25)).add(frost.mul(0.75)).clamp())
    this.metalness = 0
    this.ior = 1.31
    this.roughnessNode = float(0.16).add(cloud.mul(0.08)).add(frost.mul(0.45)).add(bubble.mul(0.08)).clamp(0.05, 0.8)
    this.clearcoat = 0.55
    this.clearcoatRoughnessNode = float(0.045).add(frost.mul(0.3)).clamp(0.02, 0.45)
    this.normalNode = proceduralNormal(crevasse.mul(0.7).sub(crevasseDeep.mul(0.35)).add(hairline.mul(near).mul(0.4)).add(frost.mul(near).mul(0.6)).add(bubble.mul(0.3)).add(bubbleRim.mul(0.2)), 0.0055)
// Light piped down the crack and scattered back out of the ice, plus the wet glint on the lip.
    const scatter = lampFlash(normalViewGeometry, 4).mul(0.5).add(0.5)
    this.emissiveNode = color(hsl.integer(237, 100, 81.3)).mul(crevasseDeep.mul(0.4).mul(grazing.mul(0.5).add(0.5)))
      .add(color(hsl.integer(230, 100, 95)).mul(lip.max(0)).mul(0.45))
      .add(color(hsl.integer(224, 100, 97)).mul(bubble.mul(intimate).mul(0.22)))
      .add(color(hsl.integer(0, 0, 100)).mul(frost.mul(intimate).mul(0.3)))
      .add(color(hsl.integer(230, 100, 85)).mul(sparkle.sparkle.mul(near).mul(0.4).mul(glimmer.mul(0.7).add(0.5))))
      .add(color(hsl.integer(233, 100, 89.4)).mul(grazing.pow(3.6)).mul(scatter.mul(0.14)))
  }
}
