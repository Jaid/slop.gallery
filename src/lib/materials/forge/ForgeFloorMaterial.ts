import {color, float, hash, max, min, mix, mx_noise_float, normalWorldGeometry, positionWorld, select, vec2} from 'three/tsl'
import {MeshStandardNodeMaterial} from 'three/webgpu'

import forge, {forgeVestibule} from '#src/lib/gallery/forge.ts'

import {heightNormal, insideBy, line, visibleDetail} from '../filters.ts'

const module = 0.13
const ratio = 4

/** Vitrified blue engineering bricks in a 45° herringbone, with a soldier course and two bronze rules at the perimeter. */
export default class ForgeFloorMaterial extends MeshStandardNodeMaterial {
  constructor() {
    super({
      roughness: 0.58,
      envMapIntensity: 0.8,
    })
    this.name = 'Forge herringbone pavers'
    const x = positionWorld.x.sub(forge.center[0]).toVar()
    const z = positionWorld.z.sub(forge.center[1]).toVar()
    const p = vec2(x.add(z), z.sub(x)).mul(Math.SQRT1_2 / module).toVar('forgePavingGrid')
    const ix = p.x.floor()
    const iz = p.y.floor()
    // The (i + j) diagonal cycles through four horizontal cells then four vertical cells. Back up to the first cell of the brick before hashing its color.
    const phase = ix.add(iz).mod(ratio * 2).add(ratio * 2).mod(ratio * 2).toVar()
    const isHorizontal = phase.lessThan(ratio)
    const lead = phase.mod(ratio)
    const along = select(isHorizontal, p.x.fract(), p.y.fract()).add(lead)
    const cross = select(isHorizontal, p.y.fract(), p.x.fract())
    const edge = min(along.min(float(ratio).sub(along)), cross.min(cross.oneMinus())).mul(module)
    const brickId = ix.sub(select(isHorizontal, lead, float(0))).mul(563).add(iz.sub(select(isHorizontal, float(0), lead))).add(100_003)
    const footprint = max(x.fwidth(), z.fwidth()).toVar('forgePavingFootprint')
    const inRound = z.lessThan(-forge.size[1] / 2)
    const dz = positionWorld.z.sub(forgeVestibule.center[1])
    const [halfW, halfD] = forge.size.map(value => value / 2)
    const toSide = float(halfW).sub(x.abs())
    const toEnd = float(halfD).sub(z.abs())
    const border = select(inRound, float(forgeVestibule.radius).sub(vec2(x, dz).length()), min(toSide, toEnd)).toVar('forgePavingBorder')
    const around = select(inRound, x.atan(dz).mul(54 / (2 * Math.PI)), select(toSide.lessThan(toEnd), z.div(0.36), x.div(0.36)))
    const soldier = insideBy(border.sub(0.56), footprint)
    // The inlaid lines use position along the floor, and do not appear on a slab’s vertical edges.
    const onTop = normalWorldGeometry.y.max(0)
    const metal = line(border.sub(0.56), 0.0075).max(line(border.sub(0.63), 0.0035)).mul(onTop)
    const joint = mix(edge, around.fract().sub(0.5).abs().oneMinus().sub(0.5).mul(0.36), soldier).toVar('forgePavingEdge')
    const jointWidth = 0.0038
    const detail = visibleDetail(footprint, module)
    const face = mix(float(0.93), insideBy(float(jointWidth).sub(joint), footprint), detail)
    const cloud = mx_noise_float(positionWorld.mul(14))
    const tone = mix(hash(brickId), hash(around.floor().add(1500)), soldier)
    const clinker = mix(color('#394853'), color('#687475'), mix(float(0.5), tone, detail).mul(0.76).add(0.12)).mul(cloud.mul(0.13).add(1))
    const paver = mix(clinker, clinker.mul(0.69), soldier)
    this.colorNode = mix(mix(color('#3f4342'), paver, face), color('#ac7849'), metal)
    this.metalnessNode = metal.mul(0.64)
    this.roughnessNode = mix(float(0.59).add(cloud.mul(0.11)).add(face.oneMinus().mul(0.25)), float(0.42), metal)
    this.normalNode = heightNormal(joint.smoothstep(jointWidth, jointWidth + 0.005).mul(0.002).add(cloud.mul(0.00034)).mul(visibleDetail(footprint, 0.045)))
  }
}
