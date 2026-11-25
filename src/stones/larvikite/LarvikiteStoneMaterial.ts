import type {Node} from 'three/webgpu'

import hsl from 'okhsl'
import {color, float, max, mix, mx_fractal_noise_float, mx_noise_float, mx_noise_vec3, positionGeometry, select, transformNormalToView, vec3} from 'three/tsl'
import {MeshStandardNodeMaterial} from 'three/webgpu'

import {heightNormal, insideBy, visibleDetail} from '#src/lib/materials/filters.ts'

import {cellRandom, cellSeed, voronoiCell} from '../lib/cells.ts'
import {randomDirection} from '../lib/crystals.ts'
import SchillerLightingModel from './SchillerLightingModel.ts'

type Float = Node<'float'>

const unit = (node: Float) => node.mul(0.5).add(0.5)
/** the lattice the feldspar crystals pack on, one to each cell, in meters */
const crystalSpacing = 0.045

/**
 * Larvikite from the quarries round Larvik in southern Norway, polished: a monzonite packed almost wholly with feldspar crystals a few centimeters across, gray as smoke, with dark seams of pyroxene, biotite and magnetite between them, and in most of them the layers that flash steel-blue, silver or, rarely, green as the light catches them.
 *
 * The crystals are the cells of a jittered lattice (`voronoiCell`), so they interlock with straight edges and carry on round every corner. Most are twinned: the plane through the middle of the crystal splits it into two halves whose layers lie at different angles, so only one half flashes at a time. Fine perthite stripes run along the layers and break the flash into bands up close. The flash itself is light (`SchillerLightingModel`), so it comes and goes with the eye and the lamps.
 */
export default class LarvikiteStoneMaterial extends MeshStandardNodeMaterial {
  private readonly lamella: Node<'vec3'>
  private readonly schiller: Node<'vec3'>
  constructor() {
    super({
      roughness: 0.1,
      envMapIntensity: 0.9,
    })
    this.name = 'Larvikite'
    const p = positionGeometry
    const footprint = max(p.x.fwidth(), max(p.y.fwidth(), p.z.fwidth())).toVar('larvikiteFootprint')
    // A gentle warp makes the crystals differ in size and bend their straight edges a little, and they lie somewhat drawn out along the stone’s flow.
    const lattice = p.div(crystalSpacing).mul(vec3(0.7, 1.3, 1)).add(mx_noise_vec3(p.mul(9)).mul(0.5)).toVar('larvikiteLattice')
    const cell = voronoiCell(lattice).toVar('larvikiteCell')
    const random = cellRandom(cell.xyz).toVar('larvikiteCrystal')
    const layers = randomDirection(cellRandom(cell.xyz, 1)).toVar('larvikiteLayers')
    const twinPlane = randomDirection(cellRandom(cell.xyz, 2))
    const offset = lattice.sub(cellSeed(cell.xyz))
    // The twin half mirrors the layers across the plane between the halves.
    const twinned = offset.dot(twinPlane).lessThan(0).and(cellRandom(cell.xyz, 3).x.lessThan(0.75))
    const lamella = select(twinned, layers.sub(twinPlane.mul(layers.dot(twinPlane).mul(2))), layers).normalize().toVar('larvikiteLamella')
    const pixel = footprint.div(crystalSpacing)
    // Most crystals meet along fine dark lines; the dark minerals gather in pockets here and there.
    const pocket = unit(mx_noise_float(p.mul(14).add(4))).smoothstep(0.68, 0.92)
    const seam = insideBy(cell.w.sub(pocket.mul(0.2).add(0.012)), pixel).toVar('larvikiteSeam')
    // Perthite: fine stripes along the layers, a millimeter or so apart.
    const stripes = mix(float(0.5), unit(lattice.dot(lamella).mul(Math.PI * 2 * 22).add(random.z.mul(9)).sin()), visibleDetail(footprint, crystalSpacing / 22))
    // Crystals from smoky to dark gray, a little browner or bluer, clouded within and zoned paler toward the rim.
    const body = mix(color(hsl.integer(267, 10, 25)), color(hsl.integer(267, 8, 46)), random.x).mul(mix(vec3(1.04, 1, 0.95), vec3(0.96, 1, 1.05), random.z))
    const cloud = unit(mx_fractal_noise_float(lattice.mul(1.8).add(random.mul(40)), 3, 2.2, 0.5))
    const zoning = cell.w.smoothstep(0.03, 0.3)
    const crystal = body.mul(cloud.mul(0.5).add(0.75)).mul(mix(float(1.12), float(0.95), zoning)).mul(stripes.sub(0.5).mul(0.08).add(1))
    // The seams: black pyroxene and magnetite, with bronze flakes of biotite.
    const biotite = unit(mx_noise_float(p.mul(400).add(13))).smoothstep(0.75, 0.85).mul(visibleDetail(footprint, 0.002))
    const seamColor = mix(color(hsl.integer(264, 6, 9)), color(hsl.integer(70, 33, 26)), biotite.mul(0.6))
    this.colorNode = mix(crystal, seamColor, seam)
    this.roughnessNode = float(0.09).add(seam.mul(0.06)).add(biotite.mul(seam).mul(0.1))
    this.normalNode = heightNormal(seam.mul(-0.00002).add(mx_noise_float(p.mul(30)).mul(0.00003)))
    // A quarter of the crystals hardly flash; the rest from steel-blue to silver, the odd one green.
    const hue = random.z
    const blue = mix(color(hsl.integer(263.5, 100, 52)), color(hsl.integer(265, 72, 78)), hue.smoothstep(0.35, 0.85))
    const tint = select(hue.greaterThan(0.93), color(hsl.integer(172, 84, 75)), blue)
    const strength = random.y.smoothstep(0.1, 0.3).mul(stripes.mul(0.6).add(0.4))
    this.lamella = transformNormalToView(lamella)
    this.schiller = tint.mul(strength).mul(seam.oneMinus()).mul(1.6)
  }
  override setupLightingModel() {
    return new SchillerLightingModel(this.lamella, this.schiller, 90, 1.53)
  }
}
