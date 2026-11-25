import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_fractal_noise_float, normalLocal, positionGeometry, time, uv, vec2, vec3} from 'three/tsl'

import {tubeCells} from '../../candidates/muse_wonder/lib/tubeMetric.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {liquidNormal} from '../../lib/liquidNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Deep-sea flesh: a dark, translucent gelatin body lit from inside. Two parallax layers are at work – clouded tissue on the surface and slower organs sampled deeper along the view ray, so the interior genuinely slides against the skin as you move. Rows of photophores, round in true tube metric, blink white-hot in a pulse that travels the whole animal, and the body breathes. Lean in and individual lanterns resolve; step back and they merge into a dotted necklace of light. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.6)
    this.name = knotData.id
    const tube = uv()
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
    const clouds = mx_fractal_noise_float(p.mul(3.2), 3, 2.1, 0.55).mul(0.5).add(0.5).clamp()
// Interior organs, sampled behind the skin along the view direction.
    const innerPos = p.sub(view.mul(0.085)).add(vec3(0, time.mul(0.01), 0))
    const organs = mx_fractal_noise_float(innerPos.mul(5.5), 3, 2.2, 0.5).mul(0.5).add(0.5).clamp()
    const organColor = mix(color(hsl.integer(263, 91, 19)), color(hsl.integer(300, 93, 41)), organs.pow(1.5))
    const flesh = mix(color(hsl.integer(231, 77, 8)), color(hsl.integer(221, 85, 22)), clouds)
// Photophores: jittered lantern cells in metric tube coordinates, so they stay round.
    const coord = tubeCells(tube, 110, 13)
    const cell = coord.floor()
    const local = coord.fract()
    const random = cellNoiseVec3(vec3(cell.x, cell.y, 23.7))
    const centre = vec2(random.x, random.y).mul(0.44).add(0.28)
    const beadDist = local.sub(centre).length()
    const radius = random.x.mul(0.045).add(0.085)
    const halo = beadDist.smoothstep(radius.mul(0.45), radius).oneMinus().mul(random.z.smoothstep(0.22, 0.38))
    const core = beadDist.smoothstep(0, radius.mul(0.42)).oneMinus().mul(halo)
    const blink = tube.x.mul(TAU * 6).sub(time.mul(Math.PI)).add(random.z.mul(1.1)).sin().mul(0.5).add(0.5).pow(6)
    const beadColor = mix(color(hsl.integer(209, 100, 83)), color(hsl.integer(338, 100, 67)), random.y.smoothstep(0.78, 0.9))
    this.colorNode = mix(flesh, organColor.mul(0.35), organs.mul(0.3))
    this.metalnessNode = float(0)
    this.roughnessNode = float(0.08).add(clouds.mul(0.1))
    this.transmissionNode = float(0.68).add(clouds.mul(0.12))
    this.thicknessNode = float(0.34).add(organs.mul(0.3))
    this.attenuationColorNode = color(hsl.integer(207, 93, 41))
    this.attenuationDistanceNode = float(0.38)
    this.ior = 1.36
    this.clearcoat = 0.6
    this.clearcoatRoughness = 0.05
    this.sheenNode = color(hsl.integer(187, 92, 81)).mul(0.1)
    this.normalNode = liquidNormal(near.mul(0.7).add(0.3), 0.38)
// Breathing: a travelling swell plus a slow whole-body heartbeat, both on the 2 s loop.
    const breath = tube.x.mul(TAU * 3).sub(time.mul(Math.PI)).sin().mul(0.0035).add(time.mul(TAU).sin().mul(0.0015))
    this.positionNode = positionGeometry.add(normalLocal.mul(breath))
    const profile = beadDist.div(radius.max(0.001)).oneMinus().clamp().pow(1.2)
    const bleed = beadDist.smoothstep(radius.mul(2.6), radius).oneMinus().mul(random.z.smoothstep(0.22, 0.38))
    this.emissiveNode = organColor.mul(organs.pow(2)).mul(facing.mul(0.5).add(0.15)).mul(0.55)
      .add(beadColor.mul(bleed).mul(blink).mul(0.35))
      .add(beadColor.mul(halo).mul(profile.mul(1.5).add(0.25)).mul(blink.mul(3).add(0.3)).mul(near.mul(0.4).add(0.85)))
      .add(color(hsl.integer(0, 0, 100)).mul(core).mul(blink.mul(5)).mul(near.mul(0.5).add(0.7)))
      .add(color(hsl.integer(190, 90, 77)).mul(grazing.pow(3)).mul(0.3))
      .add(beadColor.mul(halo).mul(intimate).mul(0.4))
  }
}
