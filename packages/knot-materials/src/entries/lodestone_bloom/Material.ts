import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, mx_noise_float, uv, vec2, vec3} from 'three/tsl'

import {tubeFrame} from '../../candidates/claude_haiku/lib/knotFrame.ts'
import {cellNoiseVec3} from '../../lib/cellNoiseVec3.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {proceduralNormal} from '../../lib/proceduralNormal.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import {wrapCell} from '../../lib/wrapCell.ts'
import knotData from './data.ts'

/** Spike lattice along the knot and around each tube. Cells are nearly square: 7.18 units of centerline over 0.82 units of circumference. */
const lattice = vec2(176, 20)
/** Viewer distances (object units) over which the lodestone pull fades in. Nearer is stronger. */
const pullNear = 1.1
const pullFar = 3.1
/** Ferrofluid bloom: spikes are height-field cones, each leaning toward the viewer and erecting as the viewer approaches. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 1)
    this.name = knotData.id
    const {cameraLocal, objectDistance} = viewerFrame()
    const tube = uv()
    const surface = tubeFrame(tube)
    const magnet = objectDistance.smoothstep(pullNear, pullFar).oneMinus()
    const home = tube.mul(lattice).floor()
    let height: Node<'float'> = float(0)
// Nine neighboring spikes cover the lean of the tallest spike; cells wrap so the random identities survive both seams.
    for (let dx = -1;dx <= 1;dx++) {
      for (let dy = -1;dy <= 1;dy++) {
        const cell = home.add(vec2(dx, dy))
        const random = cellNoiseVec3(vec3(wrapCell(cell, lattice), 5.3))
        const anchor = tubeFrame(cell.add(0.5).div(lattice))
        const offset = surface.position.sub(anchor.position)
        const lateral = vec2(offset.dot(anchor.along), offset.dot(anchor.tangent))
        const toMagnet = cameraLocal.sub(anchor.position)
        const pull = vec2(toMagnet.dot(anchor.along), toMagnet.dot(anchor.tangent)).normalize()
        const radius = random.z.mul(0.0045).add(0.0165)
        const length = random.x.mul(0.02).add(0.012).mul(magnet.mul(0.55).add(0.45))
        const present = random.y.smoothstep(0.22, 0.34)
        const apex = pull.mul(radius.mul(magnet).mul(0.65))
        const spike = length.mul(lateral.sub(apex).length().div(radius).oneMinus().max(0).pow(1.35)).mul(present)
        height = height.max(spike)
      }
    }
// Pooled ferrofluid: a faint, low-frequency swell beneath the spikes keeps the base from looking machined.
    const pool = mx_noise_float(surface.position.mul(38)).mul(0.0006)
    const relief = height.add(pool)
    this.colorNode = color(hsl.integer(285, 19, 3))
    this.metalness = 0
    this.roughness = 0.16
    this.clearcoat = 1
    this.clearcoatRoughness = 0.05
    this.sheenNode = color(hsl.integer(294, 58, 17))
    this.sheenRoughnessNode = float(0.35)
    this.normalNode = proceduralNormal(relief, 1)
    this.emissiveNode = color(hsl.integer(255, 100, 73)).mul(magnet).mul(height.div(0.034).smoothstep(0.35, 1).mul(0.12))
  }
}
