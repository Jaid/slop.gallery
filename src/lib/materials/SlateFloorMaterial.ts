import type {Node} from 'three/webgpu'

import {atan, color, float, hash, materialRoughness, max, min, mix, mx_noise_float, positionLocal, select, vec2, vec3} from 'three/tsl'
import {MeshStandardNodeMaterial} from 'three/webgpu'

import {inside, line, visibleDetail} from './filters.ts'

/** The colors of a slate floor, as sRGB hex strings. */
export type SlateStyle = {
  /** the pale dust the fractures crushed the stone into along their edges */
  dust: string
  /** the dark gap of a fracture */
  gap: string
  /** the dark grout of the joints */
  grout: string
  /** the slabs, split from different parts of the quarry: most often the first, rarest the last */
  slabs: readonly [string, string, string, string]
}

type Float = Node<'float'>

/** the slabs, in meters, laid in courses along x */
const slab = [0.9, 0.6] as const
const unit = (node: Float) => node.mul(0.5).add(0.5)

/**
 * Honed slate laid around Moonfall’s impact: the floor is mapped in its own frame, the crater’s middle at its origin.
 *
 * Large slabs in staggered courses in the colors of `style`, each split from a different part of the quarry, with the cleavage showing as faint, wavy bands. Hairline veins of white quartz run through some slabs and specks of pyrite glint gold. Out from the crater’s edge the slabs split into radial fractures that branch and peter out a few meters away.
 */
export default class SlateFloorMaterial extends MeshStandardNodeMaterial {
  constructor({craterRadius, style}: {
    /** where the cracks start, in meters from the origin */
    craterRadius: number
    style: SlateStyle
  }) {
    super({
      envMapIntensity: 0.08,
      roughness: 0.85,
    })
    const x = positionLocal.x.toVar('slateX')
    const z = positionLocal.z.toVar('slateZ')
    const footprint = max(x.fwidth(), z.fwidth()).toVar('slateFootprint')
    const detail = visibleDetail(footprint, 0.01)
    const row = z.div(slab[1]).floor()
    const rowKey = row.add(1000).mul(7919)
    const shifted = x.add(hash(rowKey).mul(slab[0]))
    const column = shifted.div(slab[0]).floor()
    const lu = shifted.div(slab[0]).fract().sub(0.5).mul(slab[0])
    const lv = z.div(slab[1]).fract().sub(0.5).mul(slab[1])
    const jointDistance = min(float(slab[0] / 2).sub(lu.abs()), float(slab[1] / 2).sub(lv.abs()))
    const joint = line(jointDistance, 0.001).mul(detail)
    const key = rowKey.add(column.add(1000)).toVar('slateSlab')
    const random = (stream: number) => hash(key.add(stream * 2_097_143))
    const pick = random(1)
    const [first, second, third, fourth] = style.slabs.map(hex => color(hex))
    const tone = select(pick.lessThan(0.4), first, select(pick.lessThan(0.72), second, select(pick.lessThan(0.94), third, fourth))).mul(random(2).sub(0.5).mul(0.14).add(1))
    // Cleavage: wavy bands across the slab at an angle of its own.
    const angle = random(3).mul(Math.PI)
    const across = lu.mul(angle.cos()).add(lv.mul(angle.sin()))
    const alongCleavage = lv.mul(angle.cos()).sub(lu.mul(angle.sin()))
    const seed = random(4).mul(70)
    const bands = unit(across.mul(18).add(mx_noise_float(vec3(alongCleavage.mul(2), across.mul(3), seed)).mul(1.8)).sin())
    const cloud = unit(mx_noise_float(vec3(x.mul(1.4), z.mul(1.4), seed.add(1))))
    // Quartz veins: thin, wandering white lines in some slabs.
    const veinField = mx_noise_float(vec3(lu.mul(2.2), lv.mul(2.2), seed.add(2))).add(mx_noise_float(vec3(lu.mul(9), lv.mul(9), seed.add(3))).mul(0.15))
    // Veins only run in stretches, where a second field allows them.
    const veinStretch = unit(mx_noise_float(vec3(lu.mul(3), lv.mul(3), seed.add(4)))).smoothstep(0.45, 0.7)
    const veins = line(veinField, 0.003).mul(veinStretch).mul(select(random(5).lessThan(0.4), float(1), float(0))).mul(detail)
    const pyrite = unit(mx_noise_float(positionLocal.mul(480))).smoothstep(0.86, 0.92).mul(visibleDetail(footprint, 0.002))
    // Radial fractures out from the crater’s edge, branching, fading out a few meters away.
    const radius = vec2(x, z).length()
    const direction = vec2(x, z).div(radius.max(0.001))
    const reach = radius.sub(craterRadius).div(4).clamp(0, 1)
    const crackField = mx_noise_float(vec3(direction.mul(7), radius.mul(0.25))).add(mx_noise_float(vec3(direction.mul(23), radius.mul(1.1).add(5))).mul(0.25))
    const branchField = mx_noise_float(vec3(direction.mul(15).add(3), radius.mul(0.6).add(9)))
    const crackWidth = float(0.009).mul(reach.oneMinus())
    const strength = reach.oneMinus().pow(1.5).mul(select(radius.greaterThan(craterRadius), float(1), float(0)))
    const angular = atan(z, x)
    const cracks = max(inside(crackField.mul(radius).div(7).abs().sub(crackWidth.add(0.0006))), inside(branchField.mul(radius).div(15).abs().sub(crackWidth.mul(0.6).add(0.0004))).mul(reach.smoothstep(0.05, 0.3))).mul(strength).mul(detail).mul(unit(mx_noise_float(vec2(angular.mul(5), 1.7))).smoothstep(0.3, 0.6)).toVar('slateCracks')
    const rough = max(joint, cracks)
    let surface: Node<'vec3'> = tone.mul(bands.sub(0.5).mul(0.16).mul(detail).add(cloud.sub(0.5).mul(0.12)).add(1))
    surface = mix(surface, color('#8e8f8a'), veins.mul(0.55))
    surface = mix(surface, color('#b0913c'), pyrite.mul(0.6))
    // The fractures crushed the stone along their edges into pale dust around a dark gap; the joints are plain dark grout.
    const crackDust = cracks.mul(crackField.mul(radius).div(7).abs().div(crackWidth.add(0.0006)).clamp(0, 1))
    surface = mix(surface, color(style.grout), joint.mul(0.85))
    surface = mix(surface, mix(color(style.gap), color(style.dust), crackDust), cracks.mul(0.9))
    this.colorNode = surface
    this.roughnessNode = mix(materialRoughness.add(bands.mul(0.04)).sub(pyrite.mul(0.05)), float(0.95), rough)
    this.metalnessNode = pyrite.mul(0.6)
  }
}
