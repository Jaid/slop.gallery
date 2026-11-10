import type {Node} from 'three/webgpu'

import {color, float, max, mix, mx_cell_noise_float, mx_noise_float, select, vec2, vec3} from 'three/tsl'
import {LatheGeometry, MeshPhysicalNodeMaterial, Vector2} from 'three/webgpu'

import {heightNormal, inside, insideBy, line, visibleDetail} from '#src/lib/materials/filters.ts'
import {paintColor, paintOrder} from '#src/lib/materials/oilPaints.ts'
import {rgb} from '#src/lib/materials/orb/fill.ts'

import PortraitFrame, {frameBack, frameTriangleBudget} from '../base/PortraitFrame.ts'
import {withOpening} from '../lib/frameBack.ts'
import {assembleFrame, ornament, place, sweepProfile} from '../lib/frameGeometry.ts'
import FrameProfile from '../lib/FrameProfile.ts'
import {frameSurface} from '../lib/materials/frameAttributes.ts'
import {backSurface, hangingWire} from '../lib/materials/frameBacks.ts'
import frameStudio from '../lib/materials/frameStudio.ts'

type Vec3 = Node<'vec3'>

const imageDepth = -0.06
const tray = 0
const brushes = 1
const back = 2
/** the tray the brushes lie in: its floor, how far out it runs and how deep it lies */
const floor = {
  from: 0.008,
  to: 0.06,
  z: -0.067,
}
/** a rounded lip at the work, the tray’s floor sunk behind it and a rounded rim round its outer edge, then down to the wall */
const profile = FrameProfile.from([-0.005, imageDepth], tray)
  .line(-0.005, -0.05)
  .arc(0.005, -0.047, 0.4, {steps: 4})
  .line(floor.from, floor.z)
  .line(floor.to, floor.z)
  .line(0.064, -0.049)
  .arc(0.076, -0.049, 0.5, {steps: 6})
  .line(0.076, frameBack)
  .line(-0.005, frameBack, {material: back})
/**
 * A brush’s outline from the end of its handle to the tip of its bristles, as how far out from its axis and how far along it, for a brush {@link brushLength} long: the handle swelling and thinning to its neck, the ferrule crimped onto it and the bristles bellying out of the ferrule to their tip.
 * The parts begin at points of their own, which the material tells apart by: the handle runs up to the fourth point, the ferrule to the sixth and the bristles on to the tip.
 */
const outline = [[0, 0], [0.0036, 0.004], [0.0056, 0.12], [0.0036, 0.196], [0.0046, 0.199], [0.0043, 0.236], [0.0052, 0.248], [0.0056, 0.272], [0.0016, 0.3]] as const
/** where the parts of a brush end, as shares of the way along its outline’s points, the way the lathe maps them */
const parts = {
  handle: 3 / (outline.length - 1),
  ferrule: 6 / (outline.length - 1),
}
/** how long a brush is at its nominal size, from which the brushes along each member stretch to fit it */
const brushLength = 0.3
/** how many sides a brush has round */
const sides = 6
/** the triangles a brush takes */
const brushTriangles = (outline.length - 1) * sides * 2
/** the two lanes the brushes lie in side by side, out past the opening in the tray */
const lanes = [0.02, 0.046] as const
/** how much thicker than a real brush of its length every brush is, so it still reads from across the room, and how much thicker at most once long brushes thicken further */
const girth = {
  base: 1.45,
  most: 1.9,
}
/** how long the brushes would rather be at least, which they grow beyond only on members too long for the triangles left */
const shortest = 0.24
/** How much thicker than its outline a brush `length` long is. */
const brushGirth = (length: number) => Math.min(girth.most, girth.base * Math.sqrt(length / brushLength))
/** A pseudo-random number from 0 to 1 for the number, the same on every run. */
const scatter = (seed: number) => {
  const value = Math.sin(seed * 127.1 + 311.7) * 43_758.5453
  return value - Math.floor(value)
}
/**
 * A brush `length` long lying along +x, its middle at the origin, its tip toward +x, flat, a filbert or round by `shape`: its uv keeps going round it and along its outline. Its kind is its number round the frame, so every brush can tell itself apart.
 */
function brush(length: number, shape: number, kind: number) {
  const scale = length / brushLength
  // Longer brushes are a little thicker too, though not as much longer.
  const thickness = brushGirth(length)
  const lathe = new LatheGeometry(outline.map(([radius, along]) => new Vector2(radius * thickness, along * scale)), sides)
  const position = lathe.getAttribute('position')
  const start = outline[parts.ferrule * (outline.length - 1)][1] * scale
  for (let index = 0; index < position.count; index++) {
    // Flats and filberts press their bristles flat in the ferrule and fan them out toward the tip.
    const into = Math.max(0, (position.getY(index) - start) / (length - start))
    if (!(shape < 2 && into > 0)) {
      continue
    }
    position.setX(index, position.getX(index) * (1 + Math.sqrt(into) * (shape === 0 ? 1.3 : 0.7)))
    position.setZ(index, position.getZ(index) * (1 - Math.sqrt(into) * (shape === 0 ? 0.6 : 0.4)))
  }
  // The lathe turns about y; laid down, its axis runs along x, the bristles’ flat side facing the viewer.
  lathe.rotateZ(-Math.PI / 2)
  lathe.translate(-length / 2, 0, 0)
  lathe.computeVertexNormals()
  return ornament(lathe, {
    kind,
    ownUv: true,
    cavity: 0,
  })
}

/** The Forge’s: paintbrushes laid end to end round the work in a shallow tray, their handles lacquered, their ferrules crimped, their bristles still loaded with paint. */
export default class BrushesFrame extends PortraitFrame {
  override readonly description = 'A shallow tray of old oak, dark with linseed oil, laid round the work, its floor spattered and wiped with paint, and paintbrushes lying in it end to end in two staggered rows all round, each its own: flats, filberts and rounds, their long handles lacquered red, black, green and blue or left bare, a few chewed and chipped, their ferrules crimped nickel or brass, their hog or sable bristles still loaded with cadmium yellow, vermilion, titanium white, ultramarine or viridian, the paint worked up into the ferrule and smudged onto the handle. Underneath, the tray is plain oak, the brush maker’s oval brand burnt into it, with a few rings left by turpentine jars and the hanging wire across it.'
  override readonly front = Math.max(profile.front, floor.z + 0.0056 * 2 * girth.most)
  override readonly imageDepth = imageDepth
  override readonly impactSound = 'hardwood'
  override readonly reach = profile.reach
  override readonly tint = '#6e4c2e'
  override readonly title = 'Brushes'

  override createGeometry(width: number, height: number) {
    const halfWidth = width / 2
    const halfHeight = height / 2
    const moulding = withOpening(sweepProfile(profile, halfWidth, halfHeight), back, halfWidth, halfHeight)
    const left = frameTriangleBudget - moulding.values().reduce((sum, part) => sum + part.getAttribute('position').count / 3, 0)
    const limit = Math.floor(left / brushTriangles)
    // Each lane of each member, from miter to miter, holds as many brushes as fit at the shortest length, fewer and longer ones where the triangles run out.
    const runs = lanes.flatMap((lane, row) => [width, height, width, height].map((side, member) => ({
      lane,
      row,
      member,
      length: side + lane * 2,
    })))
    const total = runs.reduce((sum, {length}) => sum + length, 0)
    const longest = Math.max(shortest, total / Math.max(limit, runs.length))
    let number = 0
    const placed = runs.flatMap(({lane, row, member, length}) => {
      const count = Math.max(1, Math.floor(length / longest))
      const angle = -member * Math.PI / 2
      const out = [[0, 1], [1, 0], [0, -1], [-1, 0]][member]
      const run = [[1, 0], [0, -1], [-1, 0], [0, 1]][member]
      const distance = (member % 2 === 0 ? halfHeight : halfWidth) + lane
      const share = length / count
      return Array.from({length: count}, (_, index) => {
        const seed = ++number
        // Every brush shorter than its share of the lane, so they lie apart a little, those of the outer row shorter and shifted further, so the rows don’t line up, each brush turned a little, every other one lying the other way.
        const own = share * (row === 0 ? 0.8 + scatter(seed) * 0.12 : 0.6 + scatter(seed) * 0.25)
        const along = -length / 2 + share * (index + 0.5) + (scatter(seed + 0.3) - 0.5) * (share - own) * 0.95
        const aside = (scatter(seed + 0.6) - 0.5) * 0.006
        const flipped = (index + member + row) % 2 === 1
        const geometry = brush(own, Math.floor(scatter(seed + 0.9) * 3), seed)
        return place(geometry, [{
          position: [out[0] * (distance + aside) + run[0] * along, out[1] * (distance + aside) + run[1] * along, floor.z + 0.0056 * brushGirth(own)],
          angle: angle + (flipped ? Math.PI : 0) + (scatter(seed + 1.2) - 0.5) * 0.04,
        }])
      })
    })
    return assembleFrame([...moulding, ...placed.map(part => [brushes, part] as const)])
  }

  protected override createMaterials() {
    return [new TrayMaterial, new BrushMaterial, new TrayBackMaterial]
  }
}

/** The tray: old oak gone dark with linseed oil, its grain running along the members, the floor spattered with drops of paint and wiped with smears where brushes lay. */
class TrayMaterial extends MeshPhysicalNodeMaterial {
  constructor() {
    super({
      envMap: frameStudio,
      envMapIntensity: 0.6,
      roughness: 0.55,
    })
    const surface = frameSurface()
    const p = surface.position
    const footprint = max(p.x.fwidth(), p.y.fwidth()).max(p.z.fwidth()).toVar('trayFootprint')
    const grain = mx_noise_float(vec3(surface.along.mul(3), surface.reach.mul(300).add(p.z.mul(200)), surface.member)).mul(0.5).add(0.5)
    const flecks = mx_noise_float(vec3(surface.along.mul(60), surface.reach.mul(900), surface.member)).smoothstep(0.55, 0.8).mul(visibleDetail(footprint, 0.0015))
    const oak = mix(mix(color('#4e3420'), color('#6e4c2e'), grain), color('#2e1e12'), flecks.mul(0.4))
    // On the floor, spatters of paint and smears wiped off the brushes, each in a paint of its own.
    const onFloor = surface.reach.smoothstep(floor.from, floor.from + 0.004).mul(surface.reach.smoothstep(floor.to, floor.to - 0.004)).mul(surface.isOrnament.oneMinus())
    const spatters = mx_noise_float(p.mul(140)).smoothstep(0.62, 0.7)
    const smears = mx_noise_float(vec3(surface.along.mul(24), surface.reach.mul(90), surface.member.add(5))).smoothstep(0.5, 0.62)
    const paintAt = mx_noise_float(p.mul(18).add(vec3(2.1, 0, 0))).mul(0.5).add(0.5).mul(paintOrder.length).floor()
    const paint = spatters.max(smears).mul(onFloor)
    this.colorNode = mix(oak, mix(paintColor(paintAt), color('#6a5038'), smears.mul(0.3)), paint)
    this.roughnessNode = mix(float(0.55), float(0.35), paint)
    this.normalNode = heightNormal(paint.mul(0.00015).sub(flecks.mul(0.00002)))
  }
}
/**
 * The brushes, each by its number its own: a handle lacquered in one of five colors or left bare, some chewed and chipped at the end; a ferrule of nickel or brass, crimped where it grips the handle; hog bristles or sable, still loaded with paint from the tip up into the ferrule, smudged onto the ferrule and the handle where fingers held it.
 */
class BrushMaterial extends MeshPhysicalNodeMaterial {
  constructor() {
    super({
      envMap: frameStudio,
      envMapIntensity: 0.9,
      clearcoatRoughness: 0.08,
    })
    const surface = frameSurface()
    const p = surface.position
    const footprint = max(p.x.fwidth(), p.y.fwidth()).max(p.z.fwidth()).toVar('brushFootprint')
    // Round the brush as a share of a turn, and along it as a share of the way along its outline.
    const round = surface.along.mul(Math.PI * 2)
    const t = surface.across
    const brushNumber = surface.member.sub(4).round()
    /** a random number from 0 to 1 for this brush, another for every `k` */
    const random = (k: number) => mx_cell_noise_float(vec3(brushNumber, k, 0))
    const seed = brushNumber.mul(1.731)
    const isHandle = t.lessThan(parts.handle)
    const isFerrule = t.greaterThanEqual(parts.handle).and(t.lessThan(parts.ferrule))
    const isBristles = t.greaterThanEqual(parts.ferrule)
    // The handle’s lacquer, or bare wood.
    const lacquers = ['#8a1a14', '#141414', '#1f4a35', '#1d3a7a', '#c9a46a'].map(rgb)
    const which = random(0).mul(lacquers.length).floor()
    let lacquer: Vec3 = lacquers[0]
    for (const [order, value] of lacquers.entries()) {
      if (order) {
        lacquer = select(which.greaterThan(order - 0.5), value, lacquer)
      }
    }
    const bare = which.greaterThan(lacquers.length - 1.5)
    const grain = mx_noise_float(vec3(round.cos().mul(0.6), round.sin().mul(0.6), t.mul(120).add(seed))).mul(0.5).add(0.5)
    const handle = select(bare, mix(color('#a8814e'), color('#d2ad78'), grain), lacquer)
    // Chewed and chipped at the end of some handles, the bare wood showing through the lacquer.
    const chipped = random(1).lessThan(0.4).and(bare.not())
    const chips = select(chipped, mx_noise_float(vec3(round.cos(), round.sin(), t.mul(90).add(seed))).smoothstep(0.35, 0.5).mul(t.smoothstep(0.12, 0.02)), float(0))
    // The ferrule, nickel or brass, its crimp a dark ring.
    const brass = random(2).lessThan(0.35)
    const metal = select(brass, color('#c9a55a'), color('#b4b6b8'))
    const crimp = line(t.sub(parts.handle + 0.3 / (outline.length - 1)), 0.012).mul(visibleDetail(footprint, 0.001))
    // The bristles, hog or sable, the paint they are loaded with reaching up from the tip and into the ferrule, a little worked into its edge.
    const sable = random(3).lessThan(0.3)
    const hair = select(sable, color('#5a2e16'), color('#d8c49a'))
    const strands = mx_noise_float(vec3(round.mul(8), t.mul(30), seed)).mul(0.5).add(0.5)
    const paint = paintColor(random(4).mul(paintOrder.length).floor())
    const loaded = t.smoothstep(parts.ferrule + 0.03, random(5).mul(0.04).add(parts.ferrule + 0.1)).max(mx_noise_float(vec3(round.mul(3), t.mul(40), seed.add(6))).smoothstep(0.3, 0.6).mul(t.smoothstep(parts.ferrule - 0.04, parts.ferrule + 0.02)))
    // Smudges of the same paint on the ferrule and the handle where fingers held it.
    const smudges = mx_noise_float(vec3(round.cos().mul(2), round.sin().mul(2), t.mul(25).add(seed.add(7)))).smoothstep(0.45, 0.6).mul(t.smoothstep(parts.handle - 0.2, parts.handle)).mul(isBristles.not().select(float(1), float(0)))
    const bristles = mix(mix(hair, hair.mul(0.7), strands), paint, loaded)
    const handleColor = mix(mix(handle, color('#c9a46a'), chips), paint, smudges)
    const ferruleColor = mix(mix(metal, metal.mul(0.4), crimp), paint, smudges)
    this.colorNode = select(isHandle, handleColor, select(isFerrule, ferruleColor, bristles))
    this.metalnessNode = select(isFerrule, smudges.oneMinus(), float(0))
    this.roughnessNode = select(isHandle, select(bare, float(0.55), float(0.2)).add(chips.mul(0.4)), select(isFerrule, float(0.28).add(crimp.mul(0.3)), mix(float(0.75), float(0.2), loaded)))
    this.clearcoatNode = select(isHandle, select(bare, float(0), float(0.8)).mul(chips.oneMinus()), select(isBristles, loaded.mul(0.6), float(0)))
    this.normalNode = heightNormal(select(isBristles, strands.mul(0.0001).mul(visibleDetail(footprint, 0.0015)), float(0)).sub(chips.mul(0.0002)).sub(crimp.mul(0.0002)))
  }
}
/**
 * The tray’s underside: plain oak, its grain running across the back, the brush maker’s oval brand burnt into it, dark and singed at its edges, a few rings left by turpentine jars set down on it, and the hanging wire across it.
 */
class TrayBackMaterial extends MeshPhysicalNodeMaterial {
  constructor() {
    super({
      envMap: frameStudio,
      envMapIntensity: 0.4,
      roughness: 0.7,
    })
    const surface = backSurface()
    const {footprint, opening, point} = surface
    const grain = mx_noise_float(vec3(point.x.mul(260), point.y.mul(3), 2.1)).mul(0.5).add(0.5)
    const oak = mix(color('#6a4a2e'), color('#8a6440'), grain)
    // The brand: an oval ring round a crossed pair of brushes, burnt in, singed brown round its strokes.
    const at = point.sub(vec2(0, opening.y.mul(-0.4))).mul(vec2(0.7, 1.2))
    const ring = at.length().sub(0.034).abs()
    const handles = vec2(at.x.add(at.y), at.x.sub(at.y)).abs().mul(Math.SQRT1_2)
    const crossed = handles.x.min(handles.y).max(at.length().sub(0.026))
    const burnt = inside(ring.sub(0.0012)).max(inside(crossed.sub(0.0016)))
    const singe = ring.min(crossed).div(-0.003).exp().mul(0.6)
    const branded = mix(mix(oak, color('#3a2414'), singe), color('#140c06'), burnt)
    // Dark rings left by jars of turpentine set down on it.
    const jarCell = point.div(0.16).floor()
    const random = (k: number) => mx_cell_noise_float(vec3(jarCell, k))
    const jarAt = jarCell.add(vec2(random(0), random(1)).mul(0.6).add(0.2)).mul(0.16)
    const jarRing = select(random(2).lessThan(0.25), insideBy(point.sub(jarAt).length().sub(random(3).mul(0.01).add(0.03)).abs().sub(0.0018), footprint), float(0)).mul(visibleDetail(footprint, 0.002))
    const stained = mix(branded, color('#4a3420'), jarRing.mul(0.6))
    const hanger = hangingWire(surface)
    this.colorNode = mix(stained, hanger.color, hanger.cover)
    this.metalnessNode = hanger.cover
    this.roughnessNode = mix(mix(float(0.7), float(0.85), burnt), float(0.35), hanger.cover)
    this.normalNode = heightNormal(burnt.mul(-0.0004).add(grain.mul(0.00004)).add(hanger.height))
  }
}
