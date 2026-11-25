import type {Node} from 'three/webgpu'

import hsl from 'okhsl'
import {atan, color, float, hash, log, max, min, mix, mx_noise_float, normalGeometry, positionGeometry, select, sqrt, vec2, vec3} from 'three/tsl'
import {MeshStandardNodeMaterial} from 'three/webgpu'

import {heightNormal, inside, visibleDetail} from './filters.ts'

type Float = Node<'float'>
type Vec3 = Node<'vec3'>

const unit = (node: Float) => node.mul(0.5).add(0.5)
/** A non-negative integer per cell of space within ±5000 cells, chained through hashes so that it stays small enough for floats to hold it and the hash streams added to it exactly. */
function cellKey(cell: Vec3, salt: number) {
  const z = hash(cell.z.add(5000)).mul(2048).floor()
  const y = hash(cell.y.add(5000).add(z.mul(4001))).mul(2048).floor()
  return cell.x.add(5000).add(y.mul(4001)).add(salt * 400_009)
}
/** One fossil per cell of a grid of `size` meters, at a jittered point inside it, present in `share` of the cells; its offset from that point and random streams of its own. */
function scatter(p: Vec3, size: number, share: number, salt: number) {
  const cell = p.div(size).floor()
  const key = cellKey(cell, salt)
  const random = (stream: number) => hash(key.add(stream * 1_048_573))
  const center = cell.add(vec3(random(1), random(2), random(3)).mul(0.5).add(0.25)).mul(size)
  return {
    offset: p.sub(center),
    present: select(random(4).lessThan(share), float(1), float(0)),
    random,
  }
}

/**
 * Honed Jura limestone, full of fossils, for the pedestals and the stone frames of the Lobby vault.
 *
 * A cream stone clouded with gray-blue where its iron was never oxidized, with faint bedding and a fine calcite grain that glints. Through it lie the remains of the sea floor it formed from: shell fragments cut into thin crescents, the round ossicles of crinoid stems, the odd amber belemnite guard sawn along its length, and here and there a coiled ammonite with its whorls and septa. Thin, toothed stylolite seams wander across it.
 *
 * The fossils lie in the block itself, and every face shows the section it cuts through them: a shell meets the cap and the side of a pedestal at different points, and neighboring flutes cut different fossils. Mapped in object space, so the stone continues across the cap, chamfers and carved channels and moves with the mesh. Everything smaller than a few pixels fades to its average.
 */
export default class LimestoneMaterial extends MeshStandardNodeMaterial {
  constructor() {
    super({roughness: 0.72})
    const p = positionGeometry
    const n = normalGeometry.abs()
    // Each face shows the plane it lies in.
    const facesY = n.y.greaterThan(max(n.x, n.z))
    const facesX = facesY.not().and(n.x.greaterThan(n.z))
    const planar = (v: Vec3) => select(facesY, v.xz, select(facesX, v.zy, v.xy))
    const depth = (v: Vec3) => select(facesY, v.y, select(facesX, v.x, v.z))
    const st = planar(p).toVar('limestonePlane')
    const footprint = max(st.x.fwidth(), st.y.fwidth()).toVar('limestoneFootprint')
    const fine = visibleDetail(footprint, 0.003)
    const small = visibleDetail(footprint, 0.008)
    const large = visibleDetail(footprint, 0.02)
    // The stone: cream with gray-blue clouds, faint bedding along y and a calcite grain.
    const clouds = unit(mx_noise_float(p.mul(2.2))).mul(0.65).add(unit(mx_noise_float(p.mul(7).add(3))).mul(0.35)).smoothstep(0.5, 0.8)
    const bedding = mix(float(0.5), unit(mx_noise_float(vec3(p.x.mul(3), p.y.mul(45), p.z.mul(3)))), small)
    const grain = mix(float(0.5), unit(mx_noise_float(p.mul(260))), fine)
    // Fine bioclastic sand: specks of broken shell everywhere, a little darker or paler than the matrix.
    const debris = mix(float(0.5), unit(mx_noise_float(p.mul(140).add(11))), fine)
    let stone: Node<'vec3'> = mix(color(hsl.integer(85, 27, 82)), color(hsl.integer(107, 8, 74)), clouds.mul(0.75))
    stone = stone.mul(bedding.sub(0.5).mul(0.07).add(grain.sub(0.5).mul(0.08)).add(debris.sub(0.5).smoothstep(0.25, 0.4).mul(-0.06)).add(debris.sub(0.5).negate().smoothstep(0.25, 0.4).mul(0.04)).add(1))
    // Shell fragments: curved slivers, cut as crescents a centimeter or two across where a face passes through them.
    const shell = scatter(p, 0.05, 0.5, 1)
    const shellRadius = shell.random(5).mul(0.012).add(0.008)
    const shellDepth = depth(shell.offset)
    const shellSection = sqrt(shellRadius.mul(shellRadius).sub(shellDepth.mul(shellDepth)).max(0))
    const shellLocal = planar(shell.offset)
    const shellAngle = shell.random(6).mul(Math.PI * 2)
    const shellSpan = shell.random(7).mul(0.7).add(0.3)
    const shellThickness = shell.random(8).mul(0.001).add(0.0007)
    const ring = shellLocal.length().sub(shellSection).abs().sub(shellThickness)
    const inArc = shellLocal.normalize().dot(vec2(shellAngle.cos(), shellAngle.sin())).sub(float(1).sub(shellSpan))
    const shells = inside(max(ring, inArc.negate().mul(shellSection))).mul(shell.present).mul(select(shellSection.greaterThan(0.003), float(1), float(0))).mul(small)
    // Crinoid ossicles: little discs, a hollow canal in the middle.
    const crinoid = scatter(p, 0.035, 0.4, 2)
    const crinoidRadius = crinoid.random(5).mul(0.002).add(0.0022)
    const crinoidDistance = planar(crinoid.offset).length()
    const ossicle = inside(crinoidDistance.sub(crinoidRadius)).sub(inside(crinoidDistance.sub(crinoidRadius.mul(0.3)))).mul(crinoid.present).mul(inside(depth(crinoid.offset).abs().sub(0.004))).mul(fine)
    // Belemnite guards: amber, cigar-shaped rods, cut lengthwise where a face runs along one, a dark canal down the middle.
    const belemnite = scatter(p, 0.16, 0.4, 3)
    const belemniteAngle = belemnite.random(5).mul(Math.PI)
    const belemniteLocal = planar(belemnite.offset)
    const along = belemniteLocal.dot(vec2(belemniteAngle.cos(), belemniteAngle.sin()))
    const across = belemniteLocal.dot(vec2(belemniteAngle.sin().negate(), belemniteAngle.cos()))
    const belemniteLength = belemnite.random(6).mul(0.03).add(0.035)
    const taper = float(1).sub(along.div(belemniteLength).add(0.2).clamp(0, 1).pow(2)).max(0)
    const rodRadius = belemnite.random(7).mul(0.0025).add(0.004)
    const rodDepth = depth(belemnite.offset)
    const belemniteWidth = sqrt(rodRadius.mul(rodRadius).sub(rodDepth.mul(rodDepth)).max(0)).mul(taper.sqrt())
    const belemniteBody = inside(max(across.abs().sub(belemniteWidth), along.abs().sub(belemniteLength))).mul(belemnite.present).mul(large)
    const canal = inside(across.abs().sub(0.0005)).mul(belemniteBody).mul(small).mul(inside(rodDepth.abs().sub(0.001)))
    const fibers = mix(float(0.5), unit(across.div(belemniteWidth.max(0.001)).mul(14).sin()), fine)
    // Ammonites: flat coils, cut through their whorls and septa; rare, and smaller where a face only grazes one.
    const ammonite = scatter(p, 0.26, 0.55, 4)
    const shellSize = ammonite.random(5).mul(0.03).add(0.025)
    const ammoniteDepth = depth(ammonite.offset)
    const ammoniteRadius = sqrt(shellSize.mul(shellSize).sub(ammoniteDepth.mul(ammoniteDepth).mul(1.4)).max(0))
    const growth = 0.18
    const ammoniteLocal = planar(ammonite.offset)
    const rho = ammoniteLocal.length().max(0.0005)
    const phi = atan(ammoniteLocal.y, ammoniteLocal.x).add(ammonite.random(6).mul(Math.PI * 2))
    const whorl = log(rho.div(shellSize)).div(growth * Math.PI * 2).sub(phi.div(Math.PI * 2)).fract()
    const sutureDistance = min(whorl, whorl.oneMinus()).mul(rho).mul(growth * Math.PI * 2)
    const suture = inside(sutureDistance.sub(0.0005)).mul(fine)
    const ribs = unit(phi.mul(26).add(whorl.mul(3)).sin()).mul(small)
    const inAmmonite = inside(rho.sub(ammoniteRadius)).mul(ammonite.present).mul(large)
    // Stylolites: thin, toothed seams of insoluble residue wandering across the stone.
    const seamCourse = st.y.add(mx_noise_float(vec2(st.x.mul(3), 7.7)).mul(0.05))
    const teeth = st.x.mul(220).fract().sub(0.5).abs().mul(0.004).mul(unit(mx_noise_float(vec2(st.x.mul(40), 2.2))))
    const seamOffset = seamCourse.add(teeth).div(0.37).fract().sub(0.5).mul(0.37)
    const seamPresence = unit(mx_noise_float(vec2(st.x.mul(1.4), seamCourse.div(0.37).floor().mul(3.1)))).smoothstep(0.5, 0.7)
    const stylolite = inside(seamOffset.abs().sub(0.0004)).mul(seamPresence).mul(small)
    // Calcite flecks glint in the honed face.
    const sparkle = unit(mx_noise_float(p.mul(900))).smoothstep(0.82, 0.9).mul(visibleDetail(footprint, 0.0015))
    const ammoniteTone = mix(color(hsl.integer(83, 30, 73)), color(hsl.integer(82, 25, 63)), ribs.mul(0.6))
    stone = mix(stone, color(hsl.integer(87, 27, 89)), ossicle.mul(0.55))
    stone = mix(stone, mix(color(hsl.integer(82, 25, 61)), color(hsl.integer(87, 27, 87)), shell.random(9)), shells.mul(0.7))
    stone = mix(stone, ammoniteTone, inAmmonite.mul(0.85))
    stone = mix(stone, color(hsl.integer(84, 27, 45)), suture.mul(inAmmonite).mul(0.7))
    stone = mix(stone, mix(color(hsl.integer(67, 43, 48)), color(hsl.integer(67, 41, 60)), fibers), belemniteBody.mul(0.75))
    stone = mix(stone, color(hsl.integer(70, 38, 27)), canal.mul(0.6))
    stone = mix(stone, color(hsl.integer(79, 13, 53)), stylolite.mul(0.7))
    this.colorNode = stone
    this.roughnessNode = float(0.72).add(grain.sub(0.5).mul(0.06)).sub(sparkle.mul(0.35)).sub(belemniteBody.mul(0.15)).add(stylolite.mul(0.1))
    // Fossils are harder than the matrix and stand a hair proud of the honed face; seams and sutures sit back.
    const height = shells.mul(0.00012).add(inAmmonite.mul(0.00015)).add(ribs.mul(inAmmonite).mul(0.00015)).add(belemniteBody.mul(0.00015)).sub(suture.mul(inAmmonite).mul(0.00015)).sub(stylolite.mul(0.00015)).add(grain.mul(0.00004))
    this.normalNode = heightNormal(height)
  }
}
