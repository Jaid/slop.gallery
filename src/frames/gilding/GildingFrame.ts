import type {Node} from 'three/webgpu'

import {color, float, max, mix, mx_cell_noise_float, mx_noise_float, select, smoothstep, vec2, vec3} from 'three/tsl'
import {MeshPhysicalNodeMaterial} from 'three/webgpu'

import {heightNormal, inside, line, visibleDetail} from '#src/lib/materials/filters.ts'
import {repeat} from '#src/lib/materials/sdf.ts'

import PortraitFrame, {frameBack} from '../base/PortraitFrame.ts'
import {withOpening} from '../lib/frameBack.ts'
import {assembleFrame, place, sweepProfile} from '../lib/frameGeometry.ts'
import FrameProfile from '../lib/FrameProfile.ts'
import {band, beadAndReel, legible, repeatPhase, ribbon} from '../lib/materials/carving.ts'
import {frameSurface} from '../lib/materials/frameAttributes.ts'
import {backSurface, scribble} from '../lib/materials/frameBacks.ts'
import FramePaintMaterial from '../lib/materials/FramePaintMaterial.ts'
import frameStudio from '../lib/materials/frameStudio.ts'
import {block} from '../lib/ornaments.ts'

type Float = Node<'float'>

const imageDepth = -0.05
/** the material of the back */
const back = 2
const moulding = 0
const clamp = 1
/** the carved torus, wound with a ribbon */
const torus = {
  from: 0.045,
  to: 0.062,
}
/** a carved bead at the sight edge, an ogee rising to a torus wound with a ribbon, and a cove falling to the wall, as a carver hands it to the gilder */
const profile = FrameProfile.from([-0.005, imageDepth], moulding)
  .line(-0.005, -0.042)
  .arc(0.007, -0.042, 0.5, {steps: 8})
  .line(0.01, -0.044)
  .ogee(torus.from, -0.02, {steps: 12})
  .smooth()
  .arc(torus.to, -0.02, 0.5, {steps: 10})
  .line(0.066, -0.024)
  .arc(0.09, -0.056, -0.22, {steps: 8})
  .line(0.092, -0.06)
  .line(0.092, frameBack)
  .line(-0.005, frameBack, {material: back})
/** the gold of the leaf, as the classic frame’s water gilding has it */
const leafGold = vec3(0.9, 0.55, 0.2)

/** The Cell’s: a carved moulding halfway through its water gilding, bare at the top left corner, where the miter clamp still holds it, and burnished at the bottom right. */
export default class GildingFrame extends PortraitFrame {
  override readonly description = 'Nothing in it yet, and not quite finished either: a carved moulding halfway through its water gilding, bare limewood with the carver’s pencil marks at the top left corner, where the miter clamp is still screwed on, then coats of white gesso, red and yellow bole and loose squares of gold leaf laid with their seams and holidays still showing, until it is burnished bright at the bottom right. Its back is bare limewood with the joiner’s pencil notes and crosses where the hanging rings are still to go, gesso and bole run over its edge in drips as far round as the gilder has come.'
  override readonly front = profile.front
  override readonly imageDepth = imageDepth
  override readonly reach = profile.reach
  override readonly tint = '#c9a46a'
  override readonly title = 'Unfinished gilding'

  override createGeometry(width: number, height: number) {
    const halfWidth = width / 2
    const halfHeight = height / 2
    const reach = profile.reach
    // The miter clamp on the top left corner: an iron angle hugging both outer sides round the corner, a boss on its outer corner and the screw coming out of it with its tommy bar.
    const x = -halfWidth - reach
    const y = halfHeight + reach
    /** a point `distance` out from the frame’s top left corner along its diagonal */
    const out = (distance: number) => [x - distance * Math.SQRT1_2, y + distance * Math.SQRT1_2] as const
    return assembleFrame([
      ...withOpening(sweepProfile(profile, halfWidth, halfHeight), back, halfWidth, halfHeight),
      [clamp, place(block(0.097, 0.012, 0.05, {kind: 1}), [{position: [x + 0.0365, y + 0.006, -0.072]}])],
      [clamp, place(block(0.012, 0.085, 0.05, {kind: 1}), [{position: [x - 0.006, y - 0.0425, -0.072]}])],
      [clamp, place(block(0.02, 0.02, 0.056, {kind: 2}), [{
        position: [...out(0.0127), -0.074],
        angle: Math.PI / 4,
      }])],
      [clamp, place(block(0.006, 0.024, 0.006, {kind: 3}), [{
        position: [...out(0.03), -0.05],
        angle: Math.PI / 4,
      }])],
      [clamp, place(block(0.05, 0.005, 0.005, {kind: 3}), [{
        position: [...out(0.04), -0.0495],
        angle: Math.PI / 4,
      }])],
    ])
  }

  protected override createMaterials() {
    // The clamp’s cast iron is enameled in a toolmaker’s blue, chipped back to the iron on its edges.
    return [new GildingStagesMaterial, new FramePaintMaterial({
      color: '#2c5a8c',
      roughness: 0.4,
      clearcoat: 0.3,
      wear: 0.5,
      under: '#55585b',
      grime: 0.5,
    }), new GildingBackMaterial]
  }
}

/**
 * Water gilding in every stage at once, from the top left corner of the frame, both ways round, to its bottom right: bare limewood with pencil marks, white gesso, bole, red on the crests and yellow in the hollows, gold leaf laid square by square with its seams and holidays, and burnished gold. Each layer stops in a ragged brushed edge over the one before.
 */
class GildingStagesMaterial extends MeshPhysicalNodeMaterial {
  constructor() {
    super({
      envMap: frameStudio,
      envMapIntensity: 1,
    })
    const surface = frameSurface()
    const p = surface.position
    const footprint = max(p.x.fwidth(), p.y.fwidth()).max(p.z.fwidth()).toVar('gildingFootprint')
    // Clockwise round the frame from the top left corner, 0 to 1, then folded, so both ways round from that corner lead to the bottom right one.
    const around = surface.member.round().add(surface.along.div(surface.halfLength).mul(0.5).add(0.5)).div(4)
    const progress = around.min(float(1).sub(around)).mul(2)
    const ragged = mx_noise_float(vec3(surface.along.mul(26), surface.across.mul(40), surface.member.mul(2.3))).mul(0.03).add(mx_noise_float(p.mul(240)).mul(0.012))
    const level = progress.add(ragged).toVar('gildingLevel')
    // How far the gilder has come at each stage: gesso from here on, then bole, laid leaf and burnished gold.
    const stages = [0.17, 0.35, 0.51, 0.72] as const
    const coat = (stage: 1 | 2 | 3 | 4) => select(level.greaterThanEqual(stages[stage - 1]), float(1), float(0))
    const gessoed = coat(1)
    const boled = coat(2)
    const laid = coat(3)
    const burnished = coat(4)
    const sight = band(surface, -0.005, 0.007)
    const ribboned = band(surface, torus.from, torus.to)
    const carving = legible(surface, beadAndReel(repeatPhase(surface, 0.014, 0), sight.t), 0.005).mul(sight.inside).mul(0.0022).add(legible(surface, ribbon(repeatPhase(surface, 0.022, torus.to), ribboned.t), 0.006).mul(ribboned.inside).mul(0.0018))
    const crest = surface.cavity.mul(-1).smoothstep(0.1, 0.7)
    const hollow = surface.cavity.smoothstep(0.1, 0.8)
    // Limewood, pale and close-grained, with the carver’s pencil: a setting-out line along the face and ticks across it.
    const grain = mx_noise_float(vec3(surface.along.mul(3), surface.reach.add(p.z.mul(0.6)).mul(300), surface.member)).mul(0.5).add(0.5)
    const pencil = line(surface.reach.sub(0.028), 0.00025).add(line(repeat(surface.along, 0.05), 0.0003).mul(band(surface, 0.012, 0.03).inside)).mul(visibleDetail(footprint, 0.002)).clamp(0, 1)
    const wood = mix(mix(color('#9c7748'), color('#b8935f'), grain), color('#2e2b2a'), pencil.mul(0.85))
    // Gesso, chalk white and dead flat, its brushstrokes running along the member.
    const strokes = mx_noise_float(vec3(surface.along.mul(14), surface.across.mul(420), surface.member.add(5))).mul(0.5).add(0.5)
    const gesso = mix(color('#e6e1d4'), color('#f4f1e8'), strokes)
    // Red bole on the crests, which get burnished, and yellow in the hollows, which stay matte.
    const bole = mix(color('#86402c'), color('#b0843f'), hollow).mul(strokes.mul(0.1).add(0.92))
    // Leaf laid in squares of 8.5 cm, their overlaps brighter for the double leaf, and the odd holiday letting the bole through, more of them where the gilder has only just begun.
    const leafSize = 0.085
    const seams = max(line(repeat(surface.along.add(surface.member.mul(0.031)), leafSize), 0.0012), line(repeat(surface.across, leafSize), 0.0012)).mul(visibleDetail(footprint, 0.004))
    const fresh = smoothstep(stages[2] + 0.06, stages[2], level)
    const holidays = mx_noise_float(p.mul(160)).mul(0.5).add(0.5).smoothstep(0.76, 0.8).mul(burnished.oneMinus()).add(mx_noise_float(p.mul(520)).mul(0.5).add(0.5).smoothstep(0.72, 0.78).mul(fresh)).clamp(0, 1)
    const gilt = laid.mul(holidays.oneMinus())
    const toning = mx_noise_float(p.mul(5).add(surface.piece.mul(3))).mul(0.5).add(0.5)
    // Laid leaf is a paler, softer yellow until the agate burnisher brings out its depth.
    const gold = mix(vec3(0.82, 0.6, 0.3), leafGold, burnished).mul(toning.mul(0.08).add(0.94)).mul(seams.mul(burnished.oneMinus()).mul(0.3).add(1)).mul(float(1).sub(hollow.mul(0.25)))
    let base: Node<'vec3'> = wood
    base = mix(base, gesso, gessoed)
    base = mix(base, bole, boled)
    this.colorNode = mix(base, gold, gilt)
    this.metalnessNode = gilt
    // Dead flat wood and gesso, satin bole, matte laid leaf, and burnished gold bright on the crests and matte in the hollows.
    const bare = mix(float(0.75), float(0.9), gessoed)
    const laidRoughness = float(0.5).sub(seams.mul(0.1))
    const burnishedRoughness = mix(float(0.28), float(0.08), crest)
    const rough: Float = mix(mix(bare, float(0.42), boled), mix(laidRoughness, burnishedRoughness, burnished), gilt)
    this.roughnessNode = rough
    // The leaf wrinkles where it was only pressed on; burnishing smooths it.
    const wrinkles = mx_noise_float(p.mul(700)).mul(0.00002).mul(laid.sub(burnished).max(0)).mul(visibleDetail(footprint, 0.002))
    const brush = strokes.mul(0.00002).mul(gessoed.sub(laid).max(0))
    const woodGrain = grain.mul(-0.00002).mul(gessoed.oneMinus())
    this.normalNode = heightNormal(carving.add(wrinkles).add(brush).add(woodGrain))
  }
}
/**
 * The back, still bare limewood, as nobody has fitted the hanging rings yet: only the joiner’s pencil crosses where they will go and a pencilled note, and drips of gesso and then of bole run in over its edge as far round as the gilder has come on the front, from its top left corner, seen from behind at the top right.
 */
class GildingBackMaterial extends MeshPhysicalNodeMaterial {
  constructor() {
    super({
      envMap: frameStudio,
      envMapIntensity: 0.4,
      roughness: 0.8,
    })
    const surface = backSurface()
    const {opening, point} = surface
    const outer = opening.add(profile.reach)
    const inset = outer.sub(point.abs())
    const edge = inset.x.min(inset.y)
    // How far round the frame from the front’s top left corner, 0 there to 1 at its bottom right, like the front’s stages.
    const position = point.div(outer)
    const progress = float(2).sub(position.x).sub(position.y).div(4)
    const grain = mx_noise_float(vec3(point.x.mul(90), point.y.mul(4), 4.4)).mul(0.5).add(0.5)
    const wood = mix(color('#9c7748'), color('#b8935f'), grain)
    // Drips running in from the edge, one every 14 mm along it, of their own lengths, tapering.
    const along = select(inset.x.lessThan(inset.y), point.y, point.x)
    const length = mx_cell_noise_float(vec3(along.div(0.014).floor(), 1, 0)).pow(2).mul(0.06).add(0.006)
    const across = along.div(0.014).fract().sub(0.5).abs().mul(0.014)
    const drip = inside(max(across.sub(float(0.0035).mul(float(1).sub(edge.div(length)).max(0.25))), edge.sub(length))).max(inside(edge.sub(0.005)))
    const gessoed = select(progress.greaterThan(0.17), float(1), float(0))
    const boled = select(progress.greaterThan(0.35), float(1), float(0))
    const run = mix(color('#ece7da'), color('#86402c'), boled)
    // The joiner’s pencil: a cross where each ring is to go, and a note under them.
    const ring = vec2(point.x.abs().sub(opening.x.mul(0.78)), point.y.sub(opening.y.mul(0.42)))
    const near = select(ring.length().lessThan(0.014), float(1), float(0))
    const cross = line(ring.x.add(ring.y).mul(Math.SQRT1_2), 0.0006).max(line(ring.x.sub(ring.y).mul(Math.SQRT1_2), 0.0006)).mul(near)
    const pencil = cross.max(scribble(surface, vec2(0, opening.y.mul(-0.3)), 0.26, 0.03, 3.1))
    this.colorNode = mix(mix(wood, run, drip.mul(gessoed)), color('#3a3634'), pencil.mul(0.8))
    this.roughnessNode = mix(float(0.8), float(0.9), drip.mul(gessoed))
    this.normalNode = heightNormal(drip.mul(gessoed).mul(0.0004).add(grain.mul(0.00003)))
  }
}
