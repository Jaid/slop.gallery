import type {Node} from 'three/webgpu'

import StudioEnvironment from 'knot-materials/StudioEnvironment.ts'
import hsl from 'okhsl'
import {color, float, luminance, max, mix, mx_noise_float, mx_worley_noise_float, mx_worley_noise_vec2, positionGeometry, select, vec2, vec3} from 'three/tsl'
import {Color, MeshPhysicalNodeMaterial, Vector3} from 'three/webgpu'

import {meteoriteCut} from '../gallery/moonfall/MeteoriteGeometry.ts'
import MaterialOutputsNode from '../rendering/MaterialOutputsNode.ts'
import {heightNormal, visibleDetail} from './filters.ts'

type Float = Node<'float'>

const rgb = (hex: number) => vec3(...new Color(hex))
const hash = (a: Float, b: number) => a.mul(127.1).add(b * 311.7).sin().mul(43_758.5453).fract()
/** how far apart the kamacite bars of one direction lie on the etched face, in meters */
const spacing = 0.026

/**
 * An iron meteorite for `meteoriteGeometry` of the same `radius`: a dark fusion crust pitted all over with regmaglypts, rusty in their hollows and rubbed back to bare iron on the ridges between them, sawn open on one side into a polished, etched face that shows its Widmanstätten pattern.
 *
 * On the cut, the octahedron’s planes cross in three directions 60° apart. Kamacite bars of each direction grow through some grains and not others; where two cross, one runs on and interrupts the other, edged with bright taenite, and dull plessite fills what is left.
 * Its own studio reflection keeps the iron from mirroring the dark room as a black blot, like the gunmetal’s.
 */
export default class MeteoriteMaterial extends MeshPhysicalNodeMaterial {
  private readonly studio = new StudioEnvironment

  constructor(radius: number) {
    super({
      metalness: 1,
      roughness: 0.5,
      envMapIntensity: 0.8,
      clearcoatRoughness: 0.15,
    })
    this.name = 'Iron meteorite'
    this.envMap = this.studio
    const p = positionGeometry
    const onCut = p.dot(vec3(...meteoriteCut.normal)).greaterThan(meteoriteCut.depth * radius - 0.002)
    const footprint = max(p.x.fwidth(), p.y.fwidth()).max(p.z.fwidth())
    // Regmaglypts: a shallow bowl in every cell round the mass, its rim the ridge where two cells meet.
    const cells = mx_worley_noise_vec2(p.normalize().mul(3.6))
    const pit = cells.y.sub(cells.x).smoothstep(0, 0.42)
    // Fusion crust: black-brown and slightly glassy, rusting in the hollows and rubbed back to iron on the ridges.
    const flow = mx_noise_float(p.mul(vec3(40, 90, 40))).mul(0.5).add(0.5)
    const rust = pit.smoothstep(0.7, 1).mul(mx_noise_float(p.mul(9)).mul(0.5).add(0.5).smoothstep(0.45, 0.85))
    const rubbed = pit.smoothstep(0.25, 0.02).mul(mx_noise_float(p.mul(6).add(3)).mul(0.5).add(0.5).smoothstep(0.35, 0.75))
    const crust = mix(mix(color(hsl.integer(67, 15, 9)), color(hsl.integer(59, 18, 16)), flow), color(hsl.integer(50, 55, 22)), rust.mul(0.7))
    const crustColor = mix(crust, color(hsl.integer(78, 4, 32)), rubbed.mul(0.75))
    // The glassy crust is barely metallic; only the rubbed ridges show bare iron.
    const crustMetal = float(0.12).add(rubbed.mul(0.75)).sub(rust.mul(0.1))
    const crustRough = float(0.62).sub(rubbed.mul(0.3)).add(rust.mul(0.25))
    // Widmanstätten pattern in the plane of the cut.
    const normal = meteoriteCut.normal
    // Two axes in the plane of the cut.
    const u = new Vector3(0, 1, 0)
    u.cross(normal).normalize()
    const v = normal.clone().cross(u)
    const grain = mx_worley_noise_float(p.mul(3.2)).mul(5).floor()
    let tone: Node<'vec3'> = mix(rgb(hsl.integer(258, 5, 21)), rgb(hsl.integer(264, 5, 31)), mx_noise_float(p.mul(400)).mul(0.5).add(0.5))
    let rough: Float = float(0.6)
    let edge: Float = float(0)
    let best: Float = float(-1)
    const tones = [hsl.integer(260, 4, 68), hsl.integer(261, 5, 47), hsl.integer(260, 4, 59)]
    const roughs = [0.2, 0.42, 0.3]
    for (let i = 0; i < 3; i++) {
      const angle = 0.3 + i * Math.PI / 3
      const direction = u.clone().multiplyScalar(Math.cos(angle)).addScaledVector(v, Math.sin(angle))
      const phase = p.dot(vec3(...direction)).div(spacing).add(mx_noise_float(p.mul(5).add(i * 7)).mul(0.06))
      const bar = phase.floor()
      const across = phase.fract()
      const width = hash(bar, i + 5).mul(0.22).add(0.66)
      const priority = hash(bar.add(grain.mul(31)), i + 9)
      const grows = hash(bar.add(grain.mul(17)), i + 1).lessThan(0.62)
      const wins = grows.and(across.lessThan(width)).and(priority.greaterThan(best))
      const rim = across.min(width.sub(across)).div(0.045).oneMinus().clamp()
      tone = select(wins, rgb(tones[i]), tone)
      rough = select(wins, float(roughs[i]), rough)
      edge = select(wins, rim, edge)
      best = select(wins, priority, best)
    }
    // Too fine to resolve, the bars fade to their average sheen instead of shimmering.
    const detail = visibleDetail(footprint, spacing)
    const etched = mix(rgb(hsl.integer(261, 4, 54)), mix(tone, rgb(hsl.integer(248, 3, 84)), edge.mul(0.55)), detail)
    const etchRough = mix(float(0.32), rough.sub(edge.mul(0.1)), detail)
    const reflectance = select(onCut, etched, crustColor)
    const metalness = select(onCut, float(1), crustMetal)
    const roughness = select(onCut, etchRough, crustRough)
    this.colorNode = reflectance
    this.metalnessNode = metalness
    this.roughnessNode = roughness
    this.clearcoatNode = select(onCut, float(0.3), float(0))
    const crustRelief = pit.mul(radius * -0.045).add(flow.mul(0.0004)).add(mx_worley_noise_float(p.mul(160)).mul(0.0003).mul(visibleDetail(footprint, 0.006)))
    this.normalNode = heightNormal(select(onCut, edge.mul(0.00004).mul(detail), crustRelief))
    // The screen-space reflections weigh what they add by metalness alone, which would mirror the room as brightly in the black crust as in polished iron.
    this.mrtNode = new MaterialOutputsNode({metalrough: vec2(luminance(reflectance).mul(metalness), roughness)})
  }

  override dispose() {
    this.studio.dispose()
    super.dispose()
  }
}
