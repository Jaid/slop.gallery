import type {Node} from 'three/webgpu'

import {cameraPosition, color, float, mix, modelWorldMatrixInverse, mx_noise_float, positionLocal, select, transformNormalToView, vec2, vec3, vec4} from 'three/tsl'
import {MeshPhysicalNodeMaterial} from 'three/webgpu'

import PortraitFrame, {frameBack} from '../base/PortraitFrame.ts'
import {assembleFrame, sweepProfile} from '../lib/frameGeometry.ts'
import FrameProfile from '../lib/FrameProfile.ts'
import {frameSurface} from '../lib/materials/frameAttributes.ts'
import frameStudio from '../lib/materials/frameStudio.ts'
import GiltMaterial from '../lib/materials/GiltMaterial.ts'

type Float = Node<'float'>

const imageDepth = -0.05
const gilt = 0
const illusion = 1
/** the flat face the receding steps are painted on, and where it runs */
const face = {
  z: -0.042,
  from: 0.008,
  to: 0.098,
}
/** how many steps recede into the wall, and how deep the innermost lies behind the face */
const steps = 7
const virtualDepth = 0.3
/** a gilt bead at the sight edge, the flat face of the illusion, and a gilt torus at the outer edge */
const profile = FrameProfile.from([-0.005, imageDepth], gilt)
  .line(-0.005, -0.04)
  .arc(0.006, -0.04, 0.5)
  .line(face.from, face.z, {material: illusion})
  .line(face.to, face.z)
  .line(0.1, -0.037, {material: gilt})
  .arc(0.114, -0.037, 0.5, {steps: 10})
  .line(0.118, -0.06)
  .line(0.118, frameBack)
  .line(-0.005, frameBack)
/** the members’ outward directions, top, right, bottom and left */
const outward = [[0, 1], [1, 0], [0, -1], [-1, 0]] as const
/** The Banquet’s: a flat frame whose face is a trompe-l’œil of steps receding into the wall, which shift as the viewer walks by. */
export default class PerspectiveFrame extends PortraitFrame {
  override readonly description = 'A change of perspective: a flat face, barely four centimeters deep, that opens into a tunnel of seven steps receding thirty centimeters into the wall, navy lacquer treads and gilt risers that slide and foreshorten with every step the viewer takes, between a gilt sight bead and a gilt torus.'
  override readonly front = profile.front
  override readonly imageDepth = imageDepth
  override readonly reach = profile.reach
  override readonly tint = '#22335c'
  override readonly title = 'Trompe-l’œil perspective'

  override createGeometry(width: number, height: number) {
    return assembleFrame([...sweepProfile(profile, width / 2, height / 2)])
  }

  protected override createMaterials() {
    return [new GiltMaterial({wear: 0.15}), new PerspectiveMaterial]
  }
}

/**
 * A trompe-l’œil on a flat face: through it the eye looks into a deep tunnel of steps receding toward the work, their treads lacquered navy like the Banquet’s walls and their risers gilt, which shifts with every step the viewer takes. Each point traces the view ray into those steps, as interior mapping does for windows, and shades whatever it meets with that surface’s own normal.
 */
class PerspectiveMaterial extends MeshPhysicalNodeMaterial {
  constructor() {
    super({
      envMap: frameStudio,
      envMapIntensity: 1,
      clearcoat: 0.6,
      clearcoatRoughness: 0.08,
    })
    const surface = frameSurface()
    const eye = modelWorldMatrixInverse.mul(vec4(cameraPosition, 1)).xyz
    const ray = positionLocal.sub(eye).normalize()
    const member = surface.member.round()
    const out = select(member.equal(0), vec2(...outward[0]), select(member.equal(1), vec2(...outward[1]), select(member.equal(2), vec2(...outward[2]), vec2(...outward[3]))))
    const towardOut = ray.x.mul(out.x).add(ray.y.mul(out.y))
    // Seen from in front only; from behind or edge-on, the steps flatten into the face.
    const down = ray.z.min(-0.02)
    const start = surface.reach
    const width = face.to - face.from
    const edge = (k: number) => face.from + width * k / steps
    const depthOf = (k: number) => face.z - virtualDepth * (steps - 1 - k) / (steps - 1)
    let nearest: Float = float(1e3)
    let riser: Float = float(0)
    let level: Float = float(steps - 1)
    // How far across its tread, or up its riser, the hit lies: 0 at the tread’s inner edge or the riser’s foot.
    let across: Float = float(0.5)
    for (let k = 0; k < steps; k++) {
      // The tread of step k, level at its depth across its stretch.
      const t = float(depthOf(k) - face.z).div(down)
      const r = start.add(towardOut.mul(t))
      const hits = r.greaterThanEqual(edge(k)).and(r.lessThan(edge(k + 1))).and(t.lessThan(nearest))
      nearest = select(hits, t, nearest)
      riser = select(hits, float(0), riser)
      level = select(hits, float(k), level)
      across = select(hits, r.sub(edge(k)).div(edge(k + 1) - edge(k)), across)
    }
    for (let k = 1; k < steps; k++) {
      // The riser in front of step k, facing the work, from the tread inside it up to its own; only a ray running outward meets its face.
      const t = float(edge(k)).sub(start).div(towardOut.max(1e-4))
      const z = float(face.z).add(down.mul(t))
      const hits = towardOut.greaterThan(1e-4).and(t.greaterThan(0)).and(z.greaterThanEqual(depthOf(k - 1))).and(z.lessThanEqual(depthOf(k))).and(t.lessThan(nearest))
      nearest = select(hits, t, nearest)
      riser = select(hits, float(1), riser)
      level = select(hits, float(k - 0.5), level)
      across = select(hits, z.sub(depthOf(k - 1)).div(depthOf(k) - depthOf(k - 1)), across)
    }
    const depth = float(1).sub(level.div(steps - 1)).toVar('perspectiveDepth')
    const along = surface.along.add(ray.x.mul(out.y).sub(ray.y.mul(out.x)).mul(nearest))
    const grain = mx_noise_float(vec3(along.mul(40), level.mul(3.1), surface.member)).mul(0.5).add(0.5)
    const navy = mix(color('#22335c'), color('#151f3c'), grain.mul(0.4))
    const gold = vec3(0.9, 0.58, 0.22).mul(grain.mul(0.15).add(0.9))
    // Deeper steps lie in the shadow of the ones in front of them, and every corner where a riser meets the tread below it gathers shadow.
    const corner = select(riser.greaterThan(0.5), across.smoothstep(0, 0.5), across.oneMinus().smoothstep(0, 0.35))
    const shade = depth.mul(-0.6).add(1).mul(corner.mul(0.55).add(0.45))
    this.colorNode = mix(navy, gold, riser).mul(shade)
    this.metalnessNode = riser
    this.roughnessNode = mix(float(0.32), float(0.2), riser)
    const normal = select(riser.greaterThan(0.5), vec3(out.x.negate(), out.y.negate(), 0), vec3(0, 0, 1))
    this.normalNode = transformNormalToView(normal)
  }
}
