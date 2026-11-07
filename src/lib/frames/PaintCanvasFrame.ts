import type {Metal} from '#src/lib/materials/frames/FrameMetalMaterial.ts'
import type {Node} from 'three/webgpu'

import {color, float, max, mix, mx_cell_noise_float, mx_noise_float, select, vec2, vec3} from 'three/tsl'
import {MeshPhysicalNodeMaterial} from 'three/webgpu'

import {heightNormal, inside, insideBy, line, visibleDetail} from '#src/lib/materials/filters.ts'
import {frameSurface} from '#src/lib/materials/frames/frameAttributes.ts'
import {backSurface, hangingWire} from '#src/lib/materials/frames/frameBacks.ts'
import FrameMetalMaterial from '#src/lib/materials/frames/FrameMetalMaterial.ts'
import frameStudio from '#src/lib/materials/frames/frameStudio.ts'
import FrameWoodMaterial, {oak} from '#src/lib/materials/frames/FrameWoodMaterial.ts'
import {paintColor} from '#src/lib/materials/oilPaints.ts'

import PortraitFrame, {frameBack, frameTriangleBudget} from './base/PortraitFrame.ts'
import {withOpening} from './frameBack.ts'
import {along, assembleFrame, place, sweepProfile} from './frameGeometry.ts'
import FrameProfile from './FrameProfile.ts'
import {dome} from './ornaments.ts'

type Float = Node<'float'>

const imageDepth = -0.034
const linen = 0
const wood = 1
const steel = 2
const back = 3
/** the canvas: its painted face just over the work’s edge, the stretcher’s rounded edge it is pulled over and its side down to where it meets the tray */
const canvas = {
  face: imageDepth + 0.0012,
  edge: 0.003,
  bottom: -0.076,
}
/** the floater the canvas sits in: the gap round it, the slim lip of oak and how far it stands behind the canvas’s face */
const floater = {
  gap: [canvas.edge, 0.009],
  lip: [0.009, 0.026],
  top: -0.062,
}
/**
 * The canvas pulled over its stretcher, its painted face over the work’s edge rolling over the rounded edge onto the side, down to the bottom of the floater’s gap, then the floater: up its inner wall, across its lip and down to the wall.
 */
const profile = FrameProfile.from([-0.005, imageDepth], linen)
  .line(-0.005, canvas.face)
  .line(-0.0012, canvas.face)
  .arc(canvas.edge, canvas.face - 0.0042, 0.3, {steps: 5})
  .line(canvas.edge, canvas.bottom)
  .line(floater.gap[1], canvas.bottom, {material: wood})
  .line(floater.gap[1], floater.top)
  .line(floater.lip[1] - 0.0015, floater.top)
  .arc(floater.lip[1], floater.top - 0.0015, 0.3, {steps: 3})
  .line(floater.lip[1], frameBack)
  .line(-0.005, frameBack, {material: back})
/** the tacks holding the canvas to the stretcher’s side: how far down the side, how large and how far apart */
const tack = {
  depth: 0.02,
  radius: 0.0029,
  height: 0.0011,
  spacing: 0.05,
  inset: 0.03,
  segments: 7,
}
/** the triangles of one tack: two rings of its dome round all of its sides */
const tackTriangles = 2 * 2 * tack.segments
/** how far down the side the painter’s ground and the paint reach at most, which the stretcher’s edge spills them over */
const spill = {
  ground: 0.018,
  paint: 0.008,
  drips: 0.03,
}
/** old tacks, their heads gone dark and blue-black, rust bleeding round their rims */
const tackSteel: Metal = {
  bright: '#4a4a4c',
  dull: '#1e1c1c',
  roughness: 0.5,
  patina: {
    amount: 0.6,
    color: '#6a3a1e',
  },
  texture: 0.0002,
}

/** One of the Paint Orb’s frames: the canvas itself, pulled over its stretcher and tacked to its side, the paint spilling over its edge, set into a slim oak floater with a shadow gap round it. */
export default class PaintCanvasFrame extends PortraitFrame {
  override readonly description = 'No frame at all but the canvas itself, as it came off the easel: the painting runs on over the stretcher’s rounded edge, its strokes spilling onto the side with a few drips, over a band of ragged white ground, and then raw linen, its weave showing, held by a row of old tacks, rust bleeding round their heads. It sits in a floater of pale oak, standing well proud of its lip, so the side shows from aside, with a dark shadow gap all round. Turned round, it shows the back of the canvas: raw linen between the stretcher’s pine bars, crossbars on larger works, wedge keys in the corners, the colorman’s oval stamp in the middle, the floater’s oak floor screwed on round it and the hanging wire across the bars.'
  override readonly front = canvas.face
  override readonly imageDepth = imageDepth
  override readonly impactSound = 'hardwood'
  override readonly reach = profile.reach
  override readonly tint = '#c8b590'
  override readonly title = 'Stretched canvas'

  override createGeometry(width: number, height: number) {
    const halfWidth = width / 2
    const halfHeight = height / 2
    const moulding = withOpening(sweepProfile(profile, halfWidth, halfHeight), back, halfWidth, halfHeight)
    const left = frameTriangleBudget - moulding.values().reduce((sum, part) => sum + part.getAttribute('position').count / 3, 0)
    // As many tacks as the triangles the moulding leaves, facing out of the side, tipped up from the frame’s plane.
    const tacks = along(halfWidth, halfHeight, canvas.edge, canvas.face - tack.depth, {
      spacing: tack.spacing,
      inset: tack.inset,
      limit: Math.floor(left / tackTriangles),
      tilt: -Math.PI / 2,
    })
    return assembleFrame([
      ...moulding,
      [steel, place(dome(tack.radius, tack.height, {
        rings: 2,
        segments: tack.segments,
      }), tacks)],
    ])
  }

  protected override createMaterials() {
    return [
      new CanvasMaterial,
      new FrameWoodMaterial({
        timber: oak,
        stain: '#f2ebe0',
        roughness: 0.6,
        grime: 0.2,
        shade: surface => surface.reach.smoothstep(floater.gap[0], floater.gap[1] + 0.0005).mul(0.4).add(0.6).mul(select(surface.reach.lessThan(floater.gap[1] - 0.0002), float(0.25), float(1))),
      }),
      new FrameMetalMaterial({metal: tackSteel}),
      new StretcherBackMaterial,
    ]
  }
}

/**
 * The canvas: on its face and over the stretcher’s edge, the painting’s last strokes in thick oil, dragged along the edge; down the side the paint stops in ragged brush ends, a few drips running on, over a ragged band of white ground, and below it raw linen, its weave of warm threads showing, darkened toward the bottom of the gap and stained round the rusty tacks.
 */
class CanvasMaterial extends MeshPhysicalNodeMaterial {
  constructor() {
    super({
      envMap: frameStudio,
      envMapIntensity: 0.5,
    })
    const surface = frameSurface()
    const p = surface.position
    const footprint = max(p.x.fwidth(), p.y.fwidth()).max(p.z.fwidth()).toVar('canvasFootprint')
    // How far down the side the point lies from the canvas’s face, and along the member.
    const down = float(canvas.face).sub(p.z).max(0)
    const run = surface.along
    // The weave: warp along the member, weft down the side, each thread a little uneven.
    const threads = 0.0007
    const warp = run.div(threads).mul(Math.PI * 2).sin()
    const weft = down.div(threads).mul(Math.PI * 2).sin()
    const over = warp.mul(weft).mul(0.5).add(0.5)
    const slub = mx_noise_float(vec3(run.mul(60), down.mul(1400), 1.3)).mul(0.5).add(0.5)
    const weave = over.mul(slub.mul(0.6).add(0.4)).mul(visibleDetail(footprint, threads * 2))
    const raw = mix(mix(color('#a88e64'), color('#c8b088'), slub), color('#8a7048'), weave.mul(0.35))
    // The ground, ragged where the brush ran out over the edge.
    const ragged = mx_noise_float(vec3(run.mul(70), 2.1, 0)).mul(0.5).add(0.5).mul(0.6).add(mx_noise_float(vec3(run.mul(300), 5.3, 0)).mul(0.15)).add(0.4)
    const ground = inside(down.sub(ragged.mul(spill.ground)))
    // The paint, in strokes dragged along the edge, stopping in brush ends down the side, a few drips running on below them.
    const strokes = mx_noise_float(vec3(run.mul(9), down.mul(80), 3.7)).mul(0.5).add(0.5)
    const brushEnds = mx_noise_float(vec3(run.mul(45), 7.1, 0)).mul(0.5).add(0.5)
    const paintEdge = brushEnds.mul(0.7).add(0.3).mul(spill.paint)
    const lane = run.div(0.009).floor()
    const random = (k: number) => mx_cell_noise_float(vec3(lane, surface.member, k))
    const isDrip = random(0).lessThan(0.12)
    const dripLength = random(1).mul(spill.drips - spill.paint).add(spill.paint)
    const dripMiddle = lane.add(random(2).mul(0.4).add(0.3)).mul(0.009)
    const dripWidth = float(0.0011).mul(down.div(dripLength).clamp(0, 1).mul(-0.5).add(1))
    const drip = select(isDrip, insideBy(max(run.sub(dripMiddle).abs().sub(dripWidth), down.sub(dripLength)), footprint).max(insideBy(vec2(run.sub(dripMiddle), down.sub(dripLength)).length().sub(0.0016), footprint)), float(0))
    const painted = inside(down.sub(paintEdge)).max(drip)
    // Mostly the earths a painting is built on, broken here and there by the Paint Orb’s colors, all dragged along the edge.
    const field = (scale: number, seed: number) => mx_noise_float(vec3(run.mul(scale), down.mul(30), surface.member.mul(3.1).add(seed))).mul(0.5).add(0.5)
    const earth = mix(color('#3a281a'), color('#a8803a'), field(7, 0.7).smoothstep(0.2, 0.8))
    const accented = mix(mix(mix(earth, paintColor(float(1)), field(13, 2.3).smoothstep(0.62, 0.8).mul(0.7)), paintColor(float(3)), field(11, 5.9).smoothstep(0.64, 0.82).mul(0.7)), paintColor(float(0)), field(17, 8.1).smoothstep(0.66, 0.84).mul(0.6))
    const oil = mix(accented, color('#efe6d2'), field(23, 3.3).smoothstep(0.7, 0.85).mul(0.5)).mul(strokes.mul(0.3).add(0.85))
    // The linen darkens toward the bottom of the gap, where little light reaches, and rust stains it round the tacks.
    const depthShade = down.smoothstep(0.02, 0.042).mul(0.55).oneMinus()
    const stain = mx_noise_float(vec3(run.mul(120), down.mul(120), 2.2)).mul(0.5).add(0.5).mul(line(down.sub(tack.depth), 0.004)).mul(0.5)
    const linenColor = mix(raw, color('#6a3a1e'), stain).mul(depthShade)
    const primed = mix(linenColor, mix(color('#ece6d8'), color('#d8d0bc'), weave), ground)
    this.colorNode = mix(primed, oil, painted)
    this.roughnessNode = mix(mix(float(0.88), float(0.7), ground), float(0.35), painted)
    this.clearcoatNode = painted.mul(0.3)
    this.clearcoatRoughnessNode = float(0.3)
    const ridges = strokes.mul(0.0003).mul(painted).mul(visibleDetail(footprint, 0.002))
    this.normalNode = heightNormal(weave.mul(0.00005).mul(painted.oneMinus()).add(ground.mul(0.00008)).add(painted.mul(0.0002)).add(ridges))
  }
}
/** how the back of the canvas is laid out, in meters out past the opening, negative ones inside it: the floater’s floor reaches in to the stretcher, whose bars are as wide as `bar` and stand out of the linen by `depth`, crossbars braced in once a side is longer than `brace` */
const stretcher = {
  floor: -0.015,
  bar: 0.03,
  depth: 0.0018,
  brace: 0.45,
}
/**
 * The back of the canvas: the floater’s oak floor round the edge, screwed on, then the stretcher’s pale pine bars, mitered in the corners and braced by crossbars on larger works, wedge keys tapped into its inner corners, and between them the raw back of the linen, its weave showing, darker where no light comes through, the colorman’s oval stamp inked in its middle, and the hanging wire across the bars.
 */
class StretcherBackMaterial extends MeshPhysicalNodeMaterial {
  constructor() {
    super({
      envMap: frameStudio,
      envMapIntensity: 0.4,
    })
    const surface = backSurface()
    const {footprint, opening, point} = surface
    const out = point.abs().sub(opening)
    const r = out.x.max(out.y)
    const onFloor = inside(float(stretcher.floor).sub(r))
    const inner = stretcher.floor - stretcher.bar
    const crossX = select(opening.x.greaterThan(stretcher.brace), inside(point.x.abs().sub(stretcher.bar / 2)), float(0))
    const crossY = select(opening.y.greaterThan(stretcher.brace), inside(point.y.abs().sub(stretcher.bar / 2)), float(0))
    const onBar = inside(float(inner).sub(r)).max(crossX).max(crossY).mul(onFloor.oneMinus())
    // The miters of the bars in the corners, and the keys in the inner corners, two wedges each.
    const miter = line(out.x.sub(out.y), 0.0004).mul(onBar).mul(r.greaterThan(inner).select(float(1), float(0)))
    const corner = point.abs().sub(opening.add(inner))
    const key = inside(corner.x.add(corner.y).negate().sub(0.03)).mul(inside(corner.x.max(corner.y)))
    const keyGap = line(corner.x.sub(corner.y), 0.0006).mul(key)
    // The floor’s screws, along each edge.
    const run = select(out.x.greaterThan(out.y), point.y, point.x)
    const fromScrew = run.div(0.2).fract().sub(0.5).mul(0.2)
    const screw = insideBy(vec2(fromScrew, r.sub(stretcher.floor / 2 + 0.008)).length().sub(0.0028), footprint).mul(onFloor)
    const slot = insideBy(fromScrew.abs().sub(0.0004), footprint).mul(screw)
    // The linen, its weave, the stamp.
    const weave = point.x.div(0.0007).mul(Math.PI * 2).sin().mul(point.y.div(0.0007).mul(Math.PI * 2).sin()).mul(0.5).add(0.5).mul(visibleDetail(footprint, 0.0014))
    const slub = mx_noise_float(vec3(point.x.mul(50), point.y.mul(1300), 2.2)).mul(0.5).add(0.5)
    const cloth = mix(mix(color('#8a7452'), color('#a68e68'), slub), color('#6e5a3c'), weave.mul(0.4))
    const stampAt = point.sub(vec2(opening.x.mul(0.25), opening.y.mul(-0.35))).mul(vec2(1, 1.5))
    const ring = line(stampAt.length().sub(0.03), 0.0012).max(line(stampAt.length().sub(0.026), 0.0005))
    const letters = select(stampAt.length().lessThan(0.022), mx_cell_noise_float(vec3(stampAt.mul(vec2(220, 90)), 1)).greaterThan(0.45).select(float(1), float(0)).mul(inside(stampAt.y.abs().sub(0.008))), float(0))
    const ink = ring.max(letters.mul(visibleDetail(footprint, 0.0015).mul(0.6).add(0.4))).mul(mx_noise_float(vec3(stampAt.mul(200), 3.1)).mul(0.3).add(0.7))
    const stamped = mix(cloth, color('#2a2a4a'), ink.mul(0.75))
    const pineGrain = mx_noise_float(vec3(select(out.x.greaterThan(out.y), point.y.mul(3), point.x.mul(3)), select(out.x.greaterThan(out.y), point.x.mul(220), point.y.mul(220)), 4.4)).mul(0.5).add(0.5)
    const pine = mix(color('#c8a070'), color('#e2c08e'), pineGrain)
    const oakFloor = mix(color('#a08060'), color('#c0a07a'), mx_noise_float(vec3(point.mul(vec2(3, 180)), 6.6)).mul(0.5).add(0.5))
    const timber = mix(mix(stamped, mix(pine, color('#7a5a38'), miter), onBar), mix(color('#b08a5c'), color('#5a4028'), keyGap), key)
    const floor = mix(oakFloor, mix(color('#8a8a8a'), color('#3a3a3a'), slot), screw)
    const hanger = hangingWire(surface)
    this.colorNode = mix(mix(timber, floor, onFloor), hanger.color, hanger.cover)
    this.metalnessNode = screw.max(hanger.cover)
    this.roughnessNode = mix(float(0.8), float(0.35), screw.max(hanger.cover))
    this.normalNode = heightNormal(onBar.mul(stretcher.depth).add(key.mul(0.0025)).add(onFloor.mul(stretcher.depth * 1.5)).add(weave.mul(0.00004)).add(hanger.height).sub(miter.mul(0.0003)))
  }
}
