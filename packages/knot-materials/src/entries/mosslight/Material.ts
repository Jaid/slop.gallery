import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, mx_noise_float, normalLocal, positionGeometry, time, uv, vec2, vec3} from 'three/tsl'

import {fill, stroke} from '../../candidates/gpt_sol/lib/exhibition/coverage.ts'
import {resolved, softNoise} from '../../candidates/gpt_sol/lib/exhibition/fields.ts'
import {beads} from '../../lib/beads.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import {wrapCell} from '../../lib/wrapCell.ts'
import data from './data.ts'

/** Tiny almond leaves, mineral lichen and wet dew above a slowly swelling bed of moss. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.8)
    this.name = data.id
    const tube = uv()
    const {p, near, intimate, grazing} = viewerFrame()
    const growth = softNoise(p.mul(7).add(vec3(0, time.mul(0.008), 0))).toVar()
    const swelling = mx_noise_float(p.mul(5)).mul(time.mul(0.23).sin().mul(0.18).add(1)).mul(0.0034).toVar()
    const tuft = mx_noise_float(p.mul(34).add(growth.mul(1.4))).mul(0.5).add(0.5).toVar()
    const lichen = softNoise(p.mul(16).add(18.4)).smoothstep(0.22, 0.52).toVar()
    const counts = vec2(184, 22)
    const q = tube.mul(counts)
    const random = cellNoiseVec3(vec3(wrapCell(q.floor(), counts), 71.2))
    const local = q.fract().sub(random.xy.mul(0.2).add(0.4))
    const rotation = random.z.mul(TAU)
    const point = vec2(local.x.mul(rotation.cos()).sub(local.y.mul(rotation.sin())), local.x.mul(rotation.sin()).add(local.y.mul(rotation.cos())))
    const foot = q.fwidth().length().max(0.00001)
    const leafShape = point.x.abs().div(0.18).add(point.y.div(0.34).pow2()).sub(1)
    const leaf = fill(leafShape, foot.mul(5)).mul(resolved(foot, 0.3, 1.5)).toVar()
    const vein = stroke(point.x, 0.012, foot).mul(leaf).toVar()
    const folded = point.x.abs().div(0.18).oneMinus().max(0).mul(leaf).toVar()
    const dew = beads(p.mul(76), 9.3)
    const ground = mix(color(hsl.integer(168, 75, 21)), color(hsl.integer(140, 68, 42)), growth.mul(0.5).add(0.5))
    const leafColor = mix(color(hsl.integer(144, 76, 30)), color(hsl.integer(122, 76, 71)), random.y.mul(0.45).add(tuft.mul(0.55)))
    const foliage = mix(ground, leafColor, leaf.mul(0.9)).mul(tuft.mul(0.5).add(0.65)).toVar()
    const mineral = mix(color(hsl.integer(131, 27, 58)), color(hsl.integer(96, 30, 78)), tuft)
    const green = mix(foliage, mineral, lichen.mul(0.8)).toVar()
    this.colorNode = mix(green, color(hsl.integer(168, 36, 73)), dew.mask.mul(0.45)).mul(vein.mul(-0.16).add(1))
    this.metalness = 0
    this.roughnessNode = mix(float(0.86).sub(leaf.mul(0.19)), float(0.065), dew.mask)
    this.normalNode = proceduralNormal(swelling.add(tuft.mul(0.0017)).add(folded.mul(0.00085)).add(dew.cap.mul(dew.mask).mul(0.0012)).sub(vein.mul(0.00008)), 0.65)
    this.clearcoatNode = dew.mask.mul(0.95).add(leaf.mul(0.06))
    this.clearcoatRoughnessNode = mix(float(0.4), float(0.025), dew.mask)
    this.sheenNode = color(hsl.integer(118, 60, 80)).mul(0.23).mul(dew.mask.oneMinus())
    this.sheenRoughness = 0.85
    this.aoNode = tuft.mul(0.35).add(0.65)
    // Fine tufts stay in fragment shading; only the well-sampled macro bed moves the original mesh.
    this.positionNode = positionGeometry.add(normalLocal.mul(swelling))
    const pulsePhase = tube.x.mul(TAU * 3).sub(time.mul(0.58)).add(growth.mul(2))
    const pulse = pulsePhase.sin().mul(0.5).add(0.5).pow(12)
    const spores = random.x.smoothstep(0.9, 0.98).mul(leaf).mul(point.y.smoothstep(0.05, 0.25))
    const phosphor = mix(color(hsl.integer(132.5, 100, 90.7)), color(hsl.integer(68, 100, 82)), random.z)
    this.emissiveNode = phosphor.mul(spores).mul(pulse).mul(intimate.mul(0.8).add(0.045))
      .add(color(hsl.integer(155, 46, 89)).mul(dew.mask).mul(grazing.pow(4)).mul(near).mul(0.12))
  }
}
