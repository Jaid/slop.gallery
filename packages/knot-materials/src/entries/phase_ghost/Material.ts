import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, mix, mx_cell_noise_float, positionWorld, screenUV, time, uv, vec3} from 'three/tsl'
import {DoubleSide} from 'three/webgpu'

import {cellNoiseVec3 as mx_cell_noise_vec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {opticalLine} from '../../lib/opticalLine.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** A projection that is not quite there. Nearly invisible when faced, it solidifies at grazing angles and as you approach: coarse wireframe first, then a four-times finer lattice and blinking data blocks that live inside the volume. Screen-space scanlines, a scanning plane and world-space glitch bands remind you it is light. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment)
    this.name = knotData.id
    this.envMapIntensity = 0
    // Alpha hashing currently produces an invalid Tint pipeline for these procedural opacity graphs.
    // TODO: Migrate to alphaHash again when Chromium WebGPU Tint compiler is less buggy.
    // Depth-writing alpha blending keeps the fade smooth while avoiding the old self-sorting flicker.
    this.transparent = true
    this.depthWrite = true
    this.side = DoubleSide
    const {p, view, facing, grazing, near, intimate} = viewerFrame()
    const tube = uv()
    const tick = time.mul(7).floor()
    const band = mx_cell_noise_float(vec3(positionWorld.y.mul(11).add(tick.mul(0.37)), tick, 4.2))
    const glitch = band.smoothstep(0.9, 0.93)
    const slip = glitch.mul(band.sub(0.9).mul(3))
    const u = tube.x.add(slip.mul(0.05))
    const ringsCoarse = opticalLine(u.mul(96).fract().sub(0.5), 0.05)
    const ringsFine = opticalLine(u.mul(384).fract().sub(0.5), 0.05).mul(intimate)
    const meridians = opticalLine(tube.y.mul(12).fract().sub(0.5), 0.05)
    const meridiansFine = opticalLine(tube.y.mul(48).fract().sub(0.5), 0.05).mul(intimate)
    const wire = ringsCoarse.max(meridians).add(ringsFine.add(meridiansFine).mul(0.6)).clamp()
    const scan = screenUV.y.mul(520).add(time.mul(9)).sin().mul(0.5).add(0.5).pow(6)
    const sweep = p.y.mul(2.5).sub(time.mul(0.8)).fract().smoothstep(0.88, 1)
    const inner = p.sub(view.mul(0.09))
    const dataCell = mx_cell_noise_vec3(inner.mul(38).add(vec3(0, time.mul(1.5).floor(), 0)))
    const data = dataCell.x.smoothstep(0.72, 0.76).mul(dataCell.y).mul(intimate)
    const ghost = mix(color(hsl.integer(227, 99, 74.1)), color(hsl.integer(210, 100, 93.4)), facing)
    const chroma = mix(ghost, color(hsl.integer(338, 100, 67)), glitch.mul(0.85))
    const body = grazing.pow(1.6).mul(0.55).add(scan.mul(0.12)).add(sweep.mul(0.5))
    this.colorNode = color(hsl.integer(224, 70, 4))
    this.roughness = 1
    this.metalness = 0
    this.emissiveNode = chroma.mul(wire.mul(1.6).add(body).add(data.mul(2.2))).mul(near.mul(0.6).add(0.5)).add(ghost.mul(glitch).mul(0.4))
    this.opacityNode = body.mul(0.6).add(wire.mul(0.75)).add(data).add(intimate.mul(0.15)).add(glitch.mul(0.2)).clamp()
  }
}
