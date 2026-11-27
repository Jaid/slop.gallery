import type {LatticePoint} from '#src/lib/gallery/curios/lattice.ts'
import type {Node} from 'three/webgpu'

import hsl from 'okhsl'
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js'
import {color, float, max, mix, mx_cell_noise_float, mx_cell_noise_vec3, mx_fractal_noise_float, mx_noise_float, mx_worley_noise_vec2, normalView, positionViewDirection, smoothstep, time, vec3} from 'three/tsl'
import {MeshPhysicalNodeMaterial} from 'three/webgpu'

import latticeGeometry from '#src/lib/gallery/curios/lattice.ts'
import {heightNormal, visibleDetail} from '#src/lib/materials/filters.ts'
import {frostColors} from '#src/lib/materials/frostColors.ts'

import PortraitFrame, {frameBack} from '../base/PortraitFrame.ts'
import {assembleFrame, ornament, sweepProfile} from '../lib/frameGeometry.ts'
import FrameProfile from '../lib/FrameProfile.ts'
import {frameSurface, viewBelow} from '../lib/materials/frameAttributes.ts'
import frameStudio from '../lib/materials/frameStudio.ts'

type Float = Node<'float'>

const imageDepth = -0.06
const ice = 0
const snow = 1
const icicle = 2
/** a slab of glacial ice, rimed with frost at its sight edge, its face rising gently to a rounded, wind-polished outer edge */
const profile = FrameProfile.from([-0.005, imageDepth], snow)
  .line(-0.005, -0.048)
  .arc(0.02, -0.03, 0.22, {
    material: ice,
    steps: 6,
  })
  .line(0.07, -0.026)
  .arc(0.1, -0.056, 0.32, {steps: 8})
  .line(0.1, frameBack)
  .line(-0.005, frameBack)
/** the snow heaped on the top of the frame: where its foot runs, sunk a little into the ice, how deep it lies from the back of the frame toward the viewer, how high it heaps up at most, and how many points round its cross-section */
const snowCap = {
  foot: 0.084,
  back: -0.092,
  front: -0.02,
  height: 0.058,
  around: 12,
  /** how far apart its cross-sections lie along the frame at most, and how many of them it has at most */
  spacing: 0.03,
  limit: 110,
  /** how far in from the frame’s ends the snow tapers off */
  taper: 0.05,
}
/** the icicles hanging from the front lip of the bottom of the frame, in front of its rounded outer edge: how far out past the opening their roots lie and how far in front of the frame’s middle, how far apart they hang at least and how many of them at most, and the longest they grow, which keeps them within the frame’s reach */
const icicles = {
  root: 0.07,
  front: -0.028,
  spacing: 0.028,
  limit: 72,
  longest: 0.076,
  /** how many sides they have and how many rings of them run down each */
  sides: 6,
  rings: 5,
}
/** deterministic pseudo-random fractions */
const hash = (index: number, seed: number) => {
  const value = Math.sin(index * 127.1 + seed * 311.7) * 43_758.5453
  return value - Math.floor(value)
}
/** The snow heaped along the top member, `length` meters long along x, its foot at `foot` above the frame’s middle: lumpy, drifted toward the viewer and spilling a little over the front of the ice, tapering off toward its ends. */
function snowHeap(length: number, foot: number) {
  const count = Math.min(snowCap.limit, Math.max(8, Math.ceil(length / snowCap.spacing)))
  const half = length / 2
  const middleZ = (snowCap.back + snowCap.front) / 2
  const depth = (snowCap.front - snowCap.back) / 2
  const rows = Array.from({length: count + 1}, (_, index): Array<LatticePoint> => {
    const x = -half + length * index / count
    const fromEnd = Math.max(0, half - Math.abs(x))
    const taper = Math.min(1, fromEnd / snowCap.taper) ** 0.6
    // Lumps and dips along the heap, as if the wind had heaped it.
    const lumps = 0.74 + 0.16 * Math.sin(x * 9.1 + 0.7) + 0.08 * Math.sin(x * 23.7 + 2.1) + 0.04 * Math.sin(x * 51.3)
    const height = Math.max(0.004, snowCap.height * lumps * taper)
    const reach = Math.max(0.003, depth * Math.min(1, taper * 1.4))
    return Array.from({length: snowCap.around}, (_ignored, point): LatticePoint => {
      // round the cross-section from its bottom at the back, over its top and down its front, back along its sunken foot, the way that faces its triangles out
      const angle = -Math.PI * 2 * point / snowCap.around
      const [round, y] = [-Math.cos(angle), Math.sin(angle)]
      // The lower front of it hangs down in front of the ice as a curtain, rather than sinking into its rounded edge.
      const z = round > 0 && y < 0 ? Math.max(round, 0.95) : round
      // Drifted toward the viewer: the top leans forward, and the front bulges over the ice and droops down over its face in lumps.
      const lean = y > 0 ? y * 0.25 : 0
      const droop = Math.max(0, z) * (0.01 + 0.026 * (0.5 + 0.5 * Math.sin(x * 31.7 + 1.3)) * (0.6 + 0.4 * Math.sin(x * 7.3))) * taper
      const up = y > 0 ? y ** 0.8 * height : y * 0.012 - droop * -y
      return {position: [x, foot + up, middleZ + (z + lean) * reach]}
    })
  })
  const geometry = latticeGeometry(rows, {
    start: {position: [-half, foot, middleZ]},
    end: {position: [half, foot, middleZ]},
  })
  return ornament(geometry, {kind: 1})
}
/** An icicle of `length` hanging from its root at the origin down along −y, `radius` thick there, its surface rippled in rings where its meltwater froze. */
function icicleGeometry(length: number, radius: number, seed: number) {
  const {rings, sides} = icicles
  const rows = Array.from({length: rings}, (_, ring): Array<LatticePoint> => {
    const t = ring / rings
    // Thick at its root, narrowing fast, then tapering slowly to its point, with ripples down it.
    const thickness = radius * (1 - t) ** 1.4 * (1 + 0.12 * Math.sin(t * 17 + seed * 5))
    const bend = 0.12 * radius * Math.sin(t * 3 + seed) * t
    return Array.from({length: sides}, (_ignored, side): LatticePoint => {
      const angle = -Math.PI * 2 * side / sides + seed
      return {position: [Math.cos(angle) * thickness + bend, -length * t, Math.sin(angle) * thickness]}
    })
  })
  const geometry = latticeGeometry(rows, {
    start: {position: [0, 0.002, 0]},
    end: {position: [radius * 0.05, -length, 0]},
  })
  return ornament(geometry, {
    kind: 2,
    cavity: -0.2,
  })
}
/** The Frost Orb’s: a slab of glacial ice round the work, deep blue and cracked within, rimed with frost at its sight edge, snow heaped on its top and icicles hanging from its bottom. */
export default class GlacierFrame extends PortraitFrame {
  override readonly description = 'Carved out of a glacier: a thick slab of ice round the work, clear at its wind-polished surface and deepening to a dark, glowing blue within, where fractures and trapped bubbles catch the light ever deeper than the frame could be. Hoarfrost rimes its sight edge, fresh snow lies heaped and drifted along its top, glittering and drooping over its front, and icicles hang from its bottom in clusters.'
  /** the snow’s front, drifted a little over the ice */
  override readonly front = -0.018
  override readonly imageDepth = imageDepth
  override readonly impactSound = 'heavy'
  /** down to the tips of the longest icicles, below the snow on top */
  override readonly reach = Math.max(snowCap.foot + snowCap.height, icicles.root + icicles.longest)
  override readonly tint = hsl.integer(232, 70, 62)
  override readonly title = 'Glacier ice'

  override createGeometry(width: number, height: number) {
    const halfWidth = width / 2
    const halfHeight = height / 2
    const span = width + profile.reach * 2
    const hanging = Math.min(icicles.limit, Math.max(3, Math.floor((span - 0.06) / icicles.spacing)))
    const hung = Array.from({length: hanging}, (_, index) => -span / 2 + 0.03 + (span - 0.06) * (index + 0.5) / hanging + (hash(index, 1) - 0.5) * 0.012)
      // in clusters, with gaps between them where none formed
      .filter(x => Math.sin(x * 11.3 + 0.8) > -0.7)
      .map((x, index) => {
        // Long ones here and there among shorter ones, the longest where the meltwater ran most, toward the middle and the corners, and every one long enough to hang below the frame’s outer edge.
        const middle = 1 - Math.abs(x) / (span / 2)
        const runoff = 0.55 + 0.45 * Math.max(middle, Math.abs(x) / (span / 2)) ** 2
        const cluster = 0.5 + 0.5 * Math.sin(x * 11.3 + 0.8)
        const length = icicles.longest * (0.55 + 0.45 * hash(index, 2) ** 1.3 * runoff * (0.6 + 0.4 * cluster))
        const radius = 0.0045 + length * 0.15 + hash(index, 3) * 0.002
        // its front, rippled out a little, no nearer the viewer than the frame’s front
        const z = Math.min(icicles.front + hash(index, 4) * 0.004, -0.0185 - radius * 1.15)
        const geometry = icicleGeometry(length, radius, hash(index, 5) * 6)
        geometry.translate(x, -halfHeight - icicles.root, z)
        return geometry
      })
    return assembleFrame([
      ...sweepProfile(profile, halfWidth, halfHeight),
      [snow, snowHeap(span - 0.012, halfHeight + snowCap.foot)],
      [icicle, mergeGeometries(hung)],
    ])
  }

  protected override createMaterials() {
    return [new GlacialIceMaterial, new SnowMaterial, new IcicleMaterial]
  }
}

/**
 * Glacial ice: polished smooth by the wind on its surface, which mirrors the room, and a deep blue within that glows faintly with the light it holds. Looking into it, fractures and trapped bubbles show ever deeper than the frame could be and slide against each other as the viewer moves, catching the light; toward its rims it frosts over.
 */
class GlacialIceMaterial extends MeshPhysicalNodeMaterial {
  constructor() {
    super({
      roughness: 0.06,
      envMap: frameStudio,
      envMapIntensity: 1.3,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      ior: 1.31,
    })
    const surface = frameSurface()
    const below = viewBelow(surface)
    const p = surface.position
    const footprint = max(p.x.fwidth(), p.y.fwidth()).max(p.z.fwidth()).toVar('iceFootprint')
    // Fractures at three depths, the deeper ones larger and dimmer, and bubbles in the ice between them.
    let fractures: Float = float(0)
    let bubbles: Float = float(0)
    for (const [index, depth] of [0.006, 0.018, 0.045].entries()) {
      const deep = below(depth)
      const scale = 46 / (1 + index * 0.9)
      // Fractures run in straight planes between grains of ice, like the cracks in a glacier, every grain’s edge a crack.
      const grains = mx_worley_noise_vec2(deep.mul(scale * 0.35).add(index * 7.1))
      const crack = smoothstep(0.06, 0, grains.y.sub(grains.x)).mul(mx_noise_float(deep.mul(scale * 0.2).add(index * 3.3)).smoothstep(-0.2, 0.4))
      fractures = fractures.add(crack.mul(0.75 - index * 0.2))
      const cell = mx_cell_noise_vec3(deep.mul(160 - index * 40).floor().add(index * 3.3))
      const bubble = cell.x.greaterThan(0.93).select(float(1), float(0)).mul(smoothstep(0.42, 0.18, deep.mul(160 - index * 40).fract().sub(cell.yzx.mul(0.4).add(0.3)).length()))
      bubbles = bubbles.add(bubble.mul(0.6 - index * 0.15))
    }
    const detail = visibleDetail(footprint, 0.012)
    const facing = normalView.dot(positionViewDirection).clamp(0, 1)
    // Thicker ice looks deeper: the face is darkest seen straight on, the rims light up at a grazing view, as ice does.
    const depth = mix(color(hsl.integer(232, 92, 50)), color(hsl.integer(258, 85, 18)), facing.pow(0.6).mul(0.35))
    // Hoarfrost rimes the sight edge in a ragged band, and frosts the outer edge more thinly.
    const ragged = mx_fractal_noise_float(vec3(surface.along.mul(60), surface.member.mul(3.1), 2.2), 3).mul(0.008)
    const frosted = smoothstep(0.022, 0.006, surface.reach.add(ragged)).add(smoothstep(0.09, 0.1, surface.reach.sub(ragged)).mul(0.5)).clamp()
    const rime = mx_noise_float(p.mul(900)).mul(0.5).add(0.5).mul(visibleDetail(footprint, 0.0015))
    // The ice glows from within, like a glacier’s, brightest where it lies thickest, toward the outer edge, and along its fractures.
    const thickness = smoothstep(0.02, 0.09, surface.reach)
    const pulse = time.mul(0.4).add(surface.along.mul(3)).sin().mul(0.08).add(0.92)
    this.colorNode = mix(depth.mul(0.6), color(frostColors.snow).mul(rime.mul(0.25).add(0.75)), frosted.mul(0.75))
    this.roughnessNode = mix(float(0.05), float(0.6), frosted)
    this.emissiveNode = color(frostColors.ice).mul(fractures.mul(1.3).add(bubbles.mul(1.1)).mul(detail).add(thickness.mul(0.08)).add(0.04)).mul(pulse).mul(frosted.mul(0.8).oneMinus())
    this.normalNode = heightNormal(mx_fractal_noise_float(p.mul(70), 3).mul(0.00007).mul(detail))
  }
}
/**
 * Fresh snow and hoarfrost: matte white, bluer where it lies in its own shade and in the hollows, its crystals glittering in tiny points that flash and go as the viewer moves.
 */
class SnowMaterial extends MeshPhysicalNodeMaterial {
  constructor() {
    super({
      roughness: 0.75,
      envMap: frameStudio,
      envMapIntensity: 0.9,
      sheen: 0.4,
      sheenColor: frostColors.glow,
    })
    const surface = frameSurface()
    const p = surface.position
    const footprint = max(p.x.fwidth(), p.y.fwidth()).max(p.z.fwidth()).toVar('snowFootprint')
    const grain = mx_fractal_noise_float(p.mul(260), 3).mul(0.5).add(0.5)
    const crust = mx_noise_float(p.mul(45)).mul(0.5).add(0.5)
    // Glitter: the odd crystal facing just right flashes as the viewer moves.
    const cell = p.mul(900).floor()
    const glints = mx_cell_noise_float(cell).greaterThan(0.965).select(float(1), float(0)).mul(positionViewDirection.dot(mx_cell_noise_vec3(cell.add(4.4)).mul(2).sub(1).normalize()).max(0).pow(10)).mul(visibleDetail(footprint, 0.002))
    const hollow = surface.cavity.max(0)
    this.colorNode = mix(color(frostColors.snow), color(hsl.integer(248, 60, 80)), hollow.mul(0.4).add(crust.mul(0.2)))
    // Snow throws back so much of the light that it never sinks into the dark, even on its shaded side.
    this.emissiveNode = color(frostColors.glint).mul(glints.mul(2.5)).add(color(frostColors.glow).mul(0.08))
    this.normalNode = heightNormal(grain.mul(0.0003).add(crust.mul(0.0012)).mul(visibleDetail(footprint, 0.003)))
  }
}
/**
 * Clear ice of the icicles: glassy and bright, rippled where meltwater froze, glowing cold and brightest at their points, where a drop gathers light now and then.
 */
class IcicleMaterial extends MeshPhysicalNodeMaterial {
  constructor() {
    super({
      roughness: 0.04,
      envMap: frameStudio,
      envMapIntensity: 1.6,
      clearcoat: 1,
      clearcoatRoughness: 0.01,
      ior: 1.31,
    })
    const surface = frameSurface()
    const p = surface.position
    const facing = normalView.dot(positionViewDirection).clamp(0, 1)
    const ripples = p.y.mul(420).add(mx_noise_float(p.mul(60)).mul(3)).sin().mul(0.5).add(0.5)
    // How far down the icicle the point lies from its root, where `ornament` mapped its own y: its tips glow.
    const tip = smoothstep(0.012, icicles.longest, surface.across.negate())
    const drip = time.mul(0.7).add(p.x.mul(90)).sin().max(0).pow(20).mul(tip)
    const edge = facing.oneMinus().pow(2).mul(0.45).add(0.55)
    // Clear ice shows the dark behind it through its middle and lights up along its edges, where the view through it grazes; at its root, it melts into the ice of the frame it froze onto.
    const grown = smoothstep(0, 0.014, surface.across.negate())
    this.colorNode = mix(color(hsl.integer(234, 88, 30)), mix(color(hsl.integer(236, 70, 48)), color(hsl.integer(236, 45, 88)), edge.mul(0.7).add(ripples.mul(0.15))), grown)
    this.emissiveNode = color(frostColors.ice).mul(edge.mul(0.45).add(tip.mul(0.6)).add(0.12).mul(grown.mul(0.8).add(0.2)).add(drip.mul(1.2)))
    this.normalNode = heightNormal(ripples.mul(0.00012))
  }
}
