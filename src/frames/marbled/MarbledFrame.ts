import type {Node} from 'three/webgpu'

import {color, float, mix, mx_cell_noise_float, mx_noise_float, select, time, vec2, vec3} from 'three/tsl'
import {MeshPhysicalNodeMaterial} from 'three/webgpu'

import {heightNormal, inside, line, visibleDetail} from '#src/lib/materials/filters.ts'
import {paintColor, paintOrder} from '#src/lib/materials/oilPaints.ts'

import PortraitFrame, {frameBack} from '../base/PortraitFrame.ts'
import {withOpening} from '../lib/frameBack.ts'
import {assembleFrame, sweepProfile} from '../lib/frameGeometry.ts'
import FrameProfile from '../lib/FrameProfile.ts'
import {aroundLoop, aroundOpening, frameSurface} from '../lib/materials/frameAttributes.ts'
import {backSurface, galleryLabel, hangingWire} from '../lib/materials/frameBacks.ts'
import frameStudio from '../lib/materials/frameStudio.ts'
import GiltMaterial from '../lib/materials/GiltMaterial.ts'

type Float = Node<'float'>

const imageDepth = -0.056
const gilt = 0
const marbled = 1
const back = 2
/** the cushion of marbling between the two gilt beads, how far out past the opening it runs */
const cushion = {
  from: 0.012,
  to: 0.084,
}
/** a gilt bead at the sight edge, a broad swelling cushion of marbling under varnish, a gilt bead and a round down to the wall */
const profile = FrameProfile.from([-0.005, imageDepth], gilt)
  .line(-0.005, -0.046)
  .arc(0.01, -0.046, 0.5, {steps: 8})
  .line(cushion.from, -0.046, {material: marbled})
  .arc(cushion.to, -0.046, 0.13, {steps: 16})
  .line(cushion.to + 0.002, -0.046, {material: gilt})
  .arc(0.1, -0.046, 0.5, {steps: 8})
  .arc(0.11, -0.068, 0.3, {steps: 4})
  .line(0.11, frameBack)
  .line(-0.005, frameBack, {material: back})
/** how far apart the drops of paint were laid on the bath, about, in meters, before they spread into rings and were combed */
const dropSpacing = 0.026
/** how wide the rings are that every drop spread into, as a share of the drop spacing, as drop after drop of other paints fell into its middle */
const ringWidth = 0.11
/** the comb dragged across the cushion through the drops: how many waves it draws across it and how far, in drop spacings, it pushes them along */
const comb = {
  waves: 1.5,
  push: 0.3,
}
/** how fast the bath carries the marbling round the work, in meters a second, clockwise, how fast its currents turn and how far, in drop spacings, they swirl it */
const flow = {
  speed: 0.004,
  currents: 0.04,
  swirl: 0.55,
}
/** a ground of thin size the paints float on, showing in fine veins between them */
const size = color('#efe4c8')

/** One of the Paint Orb’s frames: marbling still floating on its bath, drops of oil paint spread into rings and combed into waves, drifting round the work and curling in slow currents between two gilt beads. */
export default class MarbledFrame extends PortraitFrame {
  override readonly description = 'A marbler’s bath laid round the work between two gilt beads: drops of cadmium yellow, vermilion, ultramarine, viridian and titanium white laid side by side on the size, each spread into rings by drop after drop of other paints, pale veins of size between them, then combed across the cushion into waves, all under a glossy skin. The marbling never sets: it drifts slowly round the work and curls in the currents of the bath, without a seam through the miters, the way the Paint Orb’s ribbons curl through its oil. Its back is closed by a dust cover of brown kraft paper, taped round with gummed tape, a gallery label pasted on it and the hanging wire across it.'
  override readonly front = profile.front
  override readonly imageDepth = imageDepth
  override readonly reach = profile.reach
  override readonly tint = '#c9a35a'
  override readonly title = 'Marbling bath'

  override createGeometry(width: number, height: number) {
    return assembleFrame([...withOpening(sweepProfile(profile, width / 2, height / 2), back, width / 2, height / 2)])
  }

  protected override createMaterials() {
    return [new GiltMaterial({wear: 0.12}), new MarblingMaterial, new DustCoverMaterial]
  }
}

/**
 * Marbling on the bath: drops of oil paint laid side by side round the frame, each spread into rings by drop after drop of other paints falling into its middle, the pale size showing in fine veins between them, then combed across the cushion into waves and swirled by the bath’s slow currents. The drops lie a whole number to the round, so the last meets the first without a seam. The bath carries all of it round the work, and its currents keep turning. Under a glossy skin, the paints stand a little proud of the size.
 */
class MarblingMaterial extends MeshPhysicalNodeMaterial {
  constructor() {
    super({
      roughness: 0.35,
      envMap: frameStudio,
      envMapIntensity: 0.8,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
    })
    const surface = frameSurface()
    const p = surface.position
    const footprint = p.x.fwidth().max(p.y.fwidth()).max(p.z.fwidth()).toVar('marblingFootprint')
    const at = aroundOpening(p.xy, surface.opening)
    const middle = (cushion.from + cushion.to) / 2
    const loop = surface.opening.x.add(surface.opening.y).add(middle * 2).mul(4).toVar('marblingLoop')
    // A whole number of drops round the frame, so the last meets the first.
    const count = loop.div(dropSpacing).round().max(3).toVar('marblingCount')
    const across = at.reach.sub(cushion.from).div(dropSpacing)
    const drift = at.distance.sub(time.mul(flow.speed))
    const round = aroundLoop(drift, at.perimeter, loop).toVar('marblingRound')
    // The bath’s currents, seamless round the loop, swirling the drops, and the comb pushing them along in waves across the cushion.
    const currents = vec3(round.mul(22), across.mul(0.6).add(time.mul(flow.currents)))
    const swirl = vec3(mx_noise_float(currents), mx_noise_float(currents.add(vec3(7.3, 1.1, 3.7))), 0).add(vec3(mx_noise_float(currents.mul(2.2).add(2.9)), mx_noise_float(currents.mul(2.2).add(9.1)), 0).mul(0.45)).mul(flow.swirl).toVar('marblingSwirl')
    const combed = across.mul(Math.PI * 2 * comb.waves / ((cushion.to - cushion.from) / dropSpacing)).add(swirl.y).sin().mul(comb.push)
    const u = drift.div(at.perimeter).mul(count).add(combed).add(swirl.x).toVar('marblingU')
    const v = across.add(swirl.y.mul(0.6)).toVar('marblingV')
    // The nearest drop’s middle, among the drops round the point’s own place, numbered round the frame without a seam.
    const base = vec2(u.floor(), v.floor())
    let nearest: Float = float(9)
    let second: Float = float(9)
    let drop: Node<'vec2'> = vec2(0)
    for (const dx of [-1, 0, 1]) {
      for (const dy of [-1, 0, 1]) {
        const cell = base.add(vec2(dx, dy))
        const wrapped = vec2(cell.x.sub(count.mul(cell.x.div(count).floor())), cell.y)
        const center = cell.add(vec2(mx_cell_noise_float(vec3(wrapped, 0)), mx_cell_noise_float(vec3(wrapped, 1))).mul(0.7).add(0.15))
        const distance = vec2(u, v).sub(center).length()
        const closer = distance.lessThan(nearest)
        second = select(closer, nearest, second.min(distance))
        drop = select(closer, wrapped, drop)
        nearest = nearest.min(distance)
      }
    }
    nearest = nearest.toVar('marblingNearest')
    second = second.toVar('marblingSecond')
    drop = drop.toVar('marblingDrop')
    // The rings the drop spread into, each a paint of its own, and the vein of size where two drops meet.
    const ring = nearest.div(ringWidth).add(mx_cell_noise_float(vec3(drop, 2)).mul(3)).toVar('marblingRing')
    const paint = paintColor(mx_cell_noise_float(vec3(drop, ring.floor().add(3))).mul(paintOrder.length).floor())
    const metersPerUnit = float(dropSpacing)
    const ringEdge = ring.fract().min(ring.fract().oneMinus()).mul(ringWidth).mul(metersPerUnit)
    const ringVein = inside(ringEdge.sub(0.00025)).mul(visibleDetail(footprint, 0.0008)).mul(0.6)
    const seam = second.sub(nearest).mul(metersPerUnit).mul(0.5)
    const vein = inside(seam.sub(0.0006)).max(ringVein).mul(visibleDetail(footprint, 0.0012))
    // The paints, a little transparent where they are thin, take some of the size’s warmth.
    this.colorNode = mix(paint.mul(0.9).add(size.mul(0.08)), size, vein)
    this.normalNode = heightNormal(vein.oneMinus().mul(0.00015).add(swirl.x.mul(0.0001)))
  }
}
/**
 * The back: a dust cover of brown kraft paper stretched over the frame’s back, mottled and creased, taped round its edge with a band of gummed tape that tears raggedly along its inner edge, a rim of bare pine beyond it, a gallery label pasted on, and the hanging wire across it.
 */
class DustCoverMaterial extends MeshPhysicalNodeMaterial {
  constructor() {
    super({
      envMap: frameStudio,
      envMapIntensity: 0.4,
    })
    const surface = backSurface()
    const {footprint, opening, point} = surface
    const outer = opening.add(profile.reach)
    const inset = outer.sub(point.abs()).min(outer.sub(point.abs()).yx).x
    const fibers = mx_noise_float(vec3(point.mul(900), 1.3)).mul(0.5).add(0.5).mul(visibleDetail(footprint, 0.0008))
    const mottle = mx_noise_float(vec3(point.mul(18), 4.1)).mul(0.5).add(0.5)
    const creases = line(mx_noise_float(vec3(point.mul(vec2(3, 14)), 2.7)), 0.004).mul(mx_noise_float(vec3(point.mul(5), 8.1)).smoothstep(0.2, 0.6)).mul(visibleDetail(footprint, 0.002))
    const kraft = mix(mix(color('#a87c4e'), color('#c49a68'), mottle), color('#7a5634'), creases.mul(0.5)).mul(fibers.mul(0.12).add(0.94))
    const pine = mix(color('#b08050'), color('#d0a470'), mx_noise_float(vec3(point.x.mul(4), point.y.mul(200), 0.5)).mul(0.5).add(0.5))
    // The tape lies over the paper’s edge onto the rim, its inner edge torn.
    const torn = mx_noise_float(vec3(point.mul(300), 6.1)).mul(0.0015)
    const onPaper = inside(float(0.012).sub(inset))
    const tape = inside(float(0.006).sub(inset)).mul(inside(inset.sub(torn.add(0.034))))
    const taped = mix(mix(pine, kraft, onPaper), color('#b88c58'), tape.mul(0.85))
    const label = galleryLabel(surface, vec2(outer.x.mul(0.42), outer.y.mul(-0.5)), [0.1, 0.058])
    const hanger = hangingWire(surface)
    const labeled = mix(taped, label.color, label.cover)
    this.colorNode = mix(labeled, hanger.color, hanger.cover)
    this.metalnessNode = hanger.cover
    this.roughnessNode = mix(mix(float(0.85), float(0.55), tape), float(0.35), hanger.cover)
    this.normalNode = heightNormal(creases.mul(-0.0002).add(tape.mul(0.0002)).add(label.height).add(hanger.height).add(fibers.mul(0.00002)))
  }
}
