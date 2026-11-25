import type {Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mix, normalLocal, normalView, select, time, uv, vec2, vec3} from 'three/tsl'

import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import {cosinePalette} from '../../lib/cosinePalette.ts'
import {glints} from '../../lib/glints.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import {wrapCell} from '../../lib/wrapCell.ts'
import knotData from './data.ts'

/** Scallop lattice: 104 cells along the knot and 12 around the tube. Both counts are integers, so the seams close; the 12 keep row parity consistent. */
const grid = vec2(104, 12)
/** Urushi lacquer with raden: abalone scallops, each a nest of concentric arcs, set into lacquer that is black and mirror-smooth. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.8)
    this.name = knotData.id
    const {view} = viewerFrame()
    const tube = uv()
    const cellUv = tube.mul(grid)
// Each row's scallops are centered on its upper boundary and shifted by half a cell on alternate rows.
    const centerRow = cellUv.y.floor().add(1)
    const shift = centerRow.mod(2).mul(0.5)
    const first = cellUv.x.sub(shift).floor()
    const dy = centerRow.sub(cellUv.y)
    const dx0 = cellUv.x.sub(first.add(shift))
    const dx1 = first.add(1).add(shift).sub(cellUv.x)
    const squared0 = dx0.pow2().add(dy.pow2())
    const squared1 = dx1.pow2().add(dy.pow2())
    const left = squared0.lessThan(squared1)
    const distance = select(left, squared0, squared1).sqrt()
    const scallop = select(left, first, first.add(1))
    const id = wrapCell(vec2(scallop, centerRow), grid)
    const random = cellNoiseVec3(vec3(id, 6.1))
// Four concentric shell bands per scallop, separated by fine lacquer seams.
    const ring = distance.mul(4)
    const band = ring.floor()
    const edge = ring.fract()
    const seam = edge.min(edge.oneMinus()).smoothstep(0, 0.08)
    const shellMask = distance.smoothstep(0.96, 1).oneMinus().mul(seam)
    const facing = normalLocal.normalize().dot(view)
    const hue = random.x.mul(0.8).add(band.mul(0.12)).add(facing.mul(0.9)).add(time.mul(0.015))
    const shell = cosinePalette(hue, [0.55, 0.55, 0.6], [0.35, 0.35, 0.34], [1, 1, 1], [0, 0.1, 0.2])
    const height = shellMask.mul(0.0007).add(random.z.mul(0.0002))
    this.colorNode = mix(color(hsl.integer(309, 16, 3)), shell, shellMask)
    this.metalness = 0
    this.roughnessNode = mix(float(0.05), float(0.16), shellMask)
    this.clearcoat = 1
    this.clearcoatRoughness = 0.02
    this.iridescenceNode = shellMask.mul(0.6)
    this.iridescenceIOR = 1.5
    this.iridescenceThicknessNode = random.y.mul(220).add(260)
    this.normalNode = proceduralNormal(height, 1)
    this.emissiveNode = shell.mul(shellMask).mul(glints(normalView, 70)).mul(0.25)
  }
}
