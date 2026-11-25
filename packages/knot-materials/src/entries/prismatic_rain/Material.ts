import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, normalLocal, positionGeometry, time, uv, vec2, vec3} from 'three/tsl'

import {cellularPoints} from '../../lib/cellularPoints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {spectralColor} from '../../lib/spectralColor.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1.14)
    this.name = knotData.id
    const p = positionGeometry
    const {view, facing, grazing, near, intimate} = viewerFrame()
// Droplets are sampled at several depths instead of stamped onto the shell. Their tiny parallax
// makes the clear knot feel full of weather, with different colors separating as the camera moves.
    const layers = 5
    let rain: Node<'vec3'> = vec3(0)
    let dropletMask: Node<'float'> = float(0)
    for (let index = 0;index < layers;index++) {
      const depth = (index + 0.5) / layers
      const q = p.sub(view.mul(depth * 0.24)).add(vec3(depth * 0.04, depth * 0.03, depth * -0.055))
      const bead = cellularPoints(q.mul(41), 0.022, 0.14, 0.72).mul(near.mul(0.88).add(0.12))
      const pearl = cellularPoints(q.mul(19), 0.04, 0.2, 0.66).mul(near.mul(0.72).add(0.28))
      const phase = q.dot(vec3(2.4, -3.1, 4.8)).mul(4.2).add(depth * 5.6).add(grazing.mul(3.5)).add(time.mul(0.025))
      const tint = spectralColor(phase)
      const layer = bead.mul(1.25).add(pearl.mul(0.33))
      rain = rain.add(tint.mul(layer).mul(0.54 + (1 - depth) * 0.28))
      dropletMask = dropletMask.add(layer)
    }
    const rainAverage = rain.div(layers)
    const beadMask = dropletMask.div(layers).clamp()
    const trailField = mx_noise_float(p.mul(vec3(7, 28, 7)).add(vec3(time.mul(0.018), time.mul(-0.08), time.mul(-0.012))))
    const trails = opticalLine(trailField, 0.026).mul(near.mul(0.88).add(0.12))
    const rainGrid = uv().mul(vec2(13, 5))
    const rainLocal = rainGrid.fract().sub(0.5)
    const dropDistance = vec2(rainLocal.x.mul(3.5), rainLocal.y.add(0.08)).length()
    const dropBodyRaw = dropDistance.smoothstep(0.035, 0.16).oneMinus()
    // Use the unwrapped grid for filtering; both the body and tail stay inside their cell.
    const rainFootprint = rainGrid.fwidth()
    const dropFilter = rainFootprint.mul(vec2(3.5, 1)).length().min(0.06)
    const dropBody = dropDistance.smoothstep(0.035, dropFilter.add(0.16)).oneMinus()
    const tailAlong = rainLocal.y.negate()
    const tailWidth = tailAlong.smoothstep(0.1, 0.44).oneMinus().mul(0.046).add(0.006)
    const tailSide = rainLocal.x.abs().smoothstep(tailWidth.mul(0.35), tailWidth.add(rainFootprint.x).min(0.08)).oneMinus()
    const tailEnd = rainFootprint.y.add(0.46).min(0.49)
    const tailEnvelope = tailAlong.smoothstep(0.02, 0.1).mul(tailAlong.smoothstep(0.32, tailEnd).oneMinus())
    const dropTail = tailSide.mul(tailEnvelope)
    const dropVisibility = rainFootprint.length().smoothstep(0.15, 0.6).oneMinus()
    const surfaceDrops = dropBody.max(dropTail.mul(0.66)).mul(dropVisibility).mul(near.mul(0.82).add(0.18))
    const drops = beadMask.add(trails.mul(0.72)).add(surfaceDrops.mul(0.82)).clamp()
    const film = mx_noise_float(p.mul(7.5).add(vec3(time.mul(0.006), time.mul(-0.01), 0))).mul(0.5).add(0.5)
    const prismPhase = p.dot(vec3(2.4, -3.1, 4.8)).mul(5.5).add(grazing.mul(4.2)).add(time.mul(0.035))
    const prismColor = spectralColor(prismPhase)
    const glass = mix(color(hsl.integer(251, 63, 5)), color(hsl.integer(235, 76, 21)), facing.mul(0.42).add(grazing.mul(0.24)).add(film.mul(0.14)).clamp())
    const dropletColor = mix(prismColor, color(hsl.integer(197, 100, 99)), beadMask.mul(0.64).add(grazing.mul(0.36)).clamp())
    const rainbow = mix(glass, mix(dropletColor, rainAverage.add(color(hsl.integer(248, 62, 18))), 0.35), drops.mul(0.92).clamp())
    const rimColor = mix(color(hsl.integer(194, 92, 76.5)), color(hsl.integer(336, 91, 69)), grazing.mul(0.76).add(film.mul(0.24)))
    const surface = mix(rainbow, rimColor, grazing.pow(2.8).mul(0.38))
    const relief = drops.mul(0.0021).add(film.mul(near).mul(0.00022))
    this.colorNode = surface
    this.metalness = 0.02
    this.roughnessNode = float(0.026).add(drops.mul(0.1)).sub(grazing.mul(0.018)).clamp(0.012, 0.18)
    this.transmission = 0.62
    this.thickness = 0.72
    this.ior = 1.46
    this.dispersion = 0.56
    this.attenuationColor.set(hsl.integer(211, 47, 83))
    this.attenuationDistance = 1.8
    this.clearcoat = 1
    this.clearcoatRoughness = 0.018
    this.iridescence = 0.45
    this.iridescenceIOR = 1.31
    this.iridescenceThicknessNode = grazing.mul(270).add(310)
    this.positionNode = p.add(normalLocal.mul(dropBodyRaw.mul(0.0011)))
    this.normalNode = proceduralNormal(relief, 0.54)
    this.emissiveNode = prismColor.mul(drops).mul(near.mul(0.32).add(0.12)).mul(1.45).add(rainAverage.mul(grazing.pow(2).mul(0.22).add(near.mul(0.04))).mul(2.1)).add(color(hsl.integer(197, 99, 99)).mul(beadMask).mul(intimate.mul(0.22).add(0.04)))
  }
}
