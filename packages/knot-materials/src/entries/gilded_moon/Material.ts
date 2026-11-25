import type {Node, Texture} from 'three/webgpu'

import hsl from 'okhsl'
import {bitangentView, color, float, mix, mx_noise_float, normalViewGeometry, tangentView, time, uv, vec2, vec3} from 'three/tsl'

import {tubeVoronoi} from '../../candidates/claude_sonnet/lib/tubeVoronoiGap.ts'
import {glints} from '../../lib/glints.ts'
import {hairline} from '../../lib/hairline.ts'
import KnotMaterial from '../../lib/KnotMaterial.ts'
import {TAU} from '../../lib/TAU.ts'
import {viewerFrame} from '../../lib/viewerFrame.ts'
import knotData from './data.ts'

/** Average size of one cell of each lattice in object-space units, used to turn cell-space distances into real widths. */
const bigCell = 0.24
const fineCell = 0.078
const craqueleCell = 0.03
/** Moon-white porcelain, shattered and mended with gold lacquer. The seams are raised, hammered and alive with a slow flow of light. */
export default class extends KnotMaterial {
  constructor(environment: Texture) {
    super(environment, 0.8)
    this.name = knotData.id
    const tube = uv()
    const {p, grazing, near, intimate} = viewerFrame()
    const wobble = vec3(17.3, 4.1, 9.7)
    const warp = vec2(mx_noise_float(p.mul(5.5)).mul(0.0042), mx_noise_float(p.mul(5.5).add(wobble)).mul(0.037))
    const at = tube.add(warp)
    const shards = tubeVoronoi(at, [26, 4], 0.95, 11)
    const chips = tubeVoronoi(at.add(vec2(0.31, 0.17)), [78, 12], 0.95, 23)
    const crackle = tubeVoronoi(at, [240, 32], 0.95, 5)
    const seam = shards.edge.mul(bigCell)
    const thread = chips.edge.mul(fineCell)
    const grain = mx_noise_float(p.mul(23))
    const width = grain.mul(0.0032).add(0.0115)
    const inside = (distance: Node<'float'>, limit: Node<'float'> | number) => distance.smoothstep(limit, distance.fwidth().mul(1.4).add(limit)).oneMinus()
    const seamGold = inside(seam, width)
// Fine golden threads are only mended where a hairline fracture ran; they thin out and vanish with distance.
    const threadGate = chips.id.z.smoothstep(0.55, 0.62).mul(shards.edge.smoothstep(0.35, 0.7))
    const threadGold = inside(thread, 0.0022).mul(threadGate).mul(near.mul(0.7).add(0.3))
    const gold = seamGold.max(threadGold)
    const bead = seam.div(width).clamp().pow2().oneMinus().sqrt().mul(seamGold)
    const flank = seam.smoothstep(width, width.mul(2.6)).oneMinus().mul(seamGold.oneMinus())
    const hammer = mx_noise_float(p.mul(310)).mul(0.5).add(mx_noise_float(p.mul(120)).mul(0.5))
    const craquelure = hairline(crackle.edge.mul(craqueleCell), 0.00055).mul(gold.oneMinus()).mul(near).mul(0.45)
    const height = bead.mul(0.0019).sub(flank.mul(0.0006)).add(hammer.mul(gold).mul(0.00016)).add(mx_noise_float(p.mul(46)).mul(0.00005))
// Each shard was reseated slightly differently, so each catches the light at its own angle.
    const tiltX = shards.id.x.sub(0.5).mul(0.11)
    const tiltY = shards.id.y.sub(0.5).mul(0.11)
    const glaze = mix(color(hsl.integer(86, 15, 62)), color(hsl.integer(170, 25, 57)), shards.edge.smoothstep(0, 0.5).oneMinus().mul(0.55).add(mx_noise_float(p.mul(4)).mul(0.5).add(0.5).mul(0.3)))
    const ivory = mix(glaze.mul(shards.id.z.mul(0.5).add(0.72)), color(hsl.integer(80, 15, 56)), craquelure)
    const metal = color(hsl.integer(76, 89, 75))
    this.colorNode = mix(ivory, metal, gold)
    this.metalnessNode = gold
    this.roughnessNode = mix(float(0.09), float(0.15).add(hammer.mul(0.09)), gold)
    this.clearcoatNode = gold.oneMinus().mul(0.6)
    this.clearcoatRoughness = 0.03
    this.sheen = 0.15
    this.sheenColor.set(hsl.integer(265, 100, 84))
    this.sheenRoughness = 0.6
    this.aoNode = flank.mul(0.5).oneMinus()
    const tangent = tangentView.normalize()
    const bitangent = vec3(bitangentView as unknown as Node<'vec3'>).normalize()
    const dx = height.dFdx()
    const dy = height.dFdy()
    const gradient = tangent.mul(dx).add(bitangent.mul(dy))
    const tilted = normalViewGeometry.add(tangent.mul(tiltX)).add(bitangent.mul(tiltY)).sub(gradient.mul(12)).normalize()
    this.normalNode = tilted
// A slow surge of light runs along the seams, and the gold sparkles with tiny mica flecks when you lean in.
    const surge = tube.x.mul(TAU * 2).add(chips.id.x.mul(1.4)).sub(time.mul(0.75)).sin().mul(0.5).add(0.5).pow(6)
    const fleckNormal = tilted.add(vec3(hammer, hammer.mul(1.7).sin(), grain).mul(0.35)).normalize()
    const fleck = glints(fleckNormal, 140).mul(gold).mul(near.mul(0.6).add(0.4))
    this.emissiveNode = color(hsl.integer(65, 100, 74.4)).mul(gold).mul(surge.mul(0.55).add(0.06)).add(color(hsl.integer(92, 100, 95)).mul(fleck).mul(0.5)).add(color(hsl.integer(81, 100, 86)).mul(gold).mul(intimate).mul(0.08)).add(color(hsl.integer(264, 100, 73.5)).mul(grazing.pow(4)).mul(0.03))
  }
}
