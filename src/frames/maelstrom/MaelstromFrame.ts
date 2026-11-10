import type {Node} from 'three/webgpu'

import {atan, color, float, log, mix, mx_fractal_noise_float, mx_noise_float, normalView, positionViewDirection, time, vec2, vec3} from 'three/tsl'
import {MeshPhysicalNodeMaterial} from 'three/webgpu'

import {heightNormal} from '#src/lib/materials/filters.ts'

import PortraitFrame, {frameBack} from '../base/PortraitFrame.ts'
import {assembleFrame, sweepProfile} from '../lib/frameGeometry.ts'
import FrameProfile from '../lib/FrameProfile.ts'
import {aroundLoop, aroundOpening, frameSurface, viewBelow} from '../lib/materials/frameAttributes.ts'
import frameStudio from '../lib/materials/frameStudio.ts'

type Float = Node<'float'>
type Vec3 = Node<'vec3'>

const imageDepth = -0.058
/** a soft lip at the sight edge, then one broad, glossy swell of fluid rolling down to the wall */
const profile = FrameProfile.from([-0.005, imageDepth])
  .line(-0.005, -0.05)
  .arc(0.062, -0.03, 0.22, {steps: 16})
  .arc(0.116, -0.074, 0.32, {steps: 12})
  .line(0.116, frameBack)
  .line(-0.005, frameBack)
/** how far out past the opening the middle of the fluid runs, where the vortices turn on the corners */
const middle = 0.056
/** how fast the surface runs round the work, clockwise, in meters a second */
const surfaceSpeed = 0.045
/** the currents under the surface, each deeper, dimmer and slower than the one above it, the deepest running back against the others */
const layers = [{
  depth: 0.008,
  speed: 0.03,
  light: 0.9,
}, {
  depth: 0.022,
  speed: 0.016,
  light: 0.6,
}, {
  depth: 0.05,
  speed: -0.012,
  light: 0.45,
}]
/** the vortex on every corner: how far out it draws the fluid in, the radius of its eye, how deep the eye lies and how fast it turns, in radians a second */
const vortex = {
  radius: 0.07,
  eye: 0.016,
  depth: 0.03,
  spin: 1.2,
}
/** the portal’s colors: its deep middle, its swirl and its hot rim */
const core = color('#02140b')
const swirl = color('#3fd98a')
const rim = color('#d4ffe8')

/** One of the Spook Orb’s frames, a maelstrom: portal fluid streaming round the work over deeper currents, drawn into a whirling portal on every corner. */
export default class MaelstromFrame extends PortraitFrame {
  override readonly description = 'Fluid spilled from a portal and still caught in its pull: glossy, glowing green ectoplasm streams round and round the work, its smoky surface sliding over deeper currents that run slower and back against it, and on every corner it is sucked into a whirling vortex, spiral arms winding down into a dark eye ringed with a white-hot rim, like a small fusion portal.'
  override readonly front = profile.front
  override readonly imageDepth = imageDepth
  override readonly reach = profile.reach
  override readonly tint = '#3fd98a'
  override readonly title = 'Ectoplasm maelstrom'

  override createGeometry(width: number, height: number) {
    return assembleFrame([...sweepProfile(profile, width / 2, height / 2)])
  }

  protected override createMaterials() {
    return [new MaelstromMaterial]
  }
}

/**
 * Portal fluid in a maelstrom: under a glossy surface, smoke-like swirls of green light stream round the frame, clockwise and without a seam through the miters, over currents lying deeper inside it that slide against the surface as the viewer moves. On every corner the fluid is drawn into a vortex like the fusion portal’s, its arms winding tighter toward its middle, where an eye opens deeper down, dark inside a wobbling, white-hot rim; the corners alternate in which way they turn.
 */
class MaelstromMaterial extends MeshPhysicalNodeMaterial {
  constructor() {
    super({
      roughness: 0.06,
      envMap: frameStudio,
      envMapIntensity: 1,
      clearcoat: 1,
      clearcoatRoughness: 0.03,
    })
    const surface = frameSurface()
    const p = surface.position
    const below = viewBelow(surface)
    const loop = surface.opening.x.add(surface.opening.y).add(middle * 2).mul(4)
    /** Where noise is sampled for the fluid `depth` meters down, running round the work at `speed`: round a loop in x and y, out past the opening in z, in meters. */
    const current = (depth: number, speed: number): Vec3 => {
      const at = aroundOpening(below(depth).xy, surface.opening)
      return vec3(aroundLoop(at.distance.sub(time.mul(speed)), at.perimeter, loop), at.reach)
    }
    // The surface: smoke curling as it streams, noise warped by noise, its swirls drawn out along the stream.
    const top = current(0, surfaceSpeed).toVar('maelstromTop')
    const warp = vec3(mx_noise_float(top.mul(18).add(vec3(0, 0, time.mul(0.25)))), mx_noise_float(top.mul(18).add(vec3(5.2, 1.3, time.mul(0.25)))), 0).mul(0.012).toVar('maelstromWarp')
    const smoke = mx_fractal_noise_float(top.add(warp).mul(vec3(18, 18, 30)).add(vec3(0, 0, time.mul(0.1))), 3).mul(0.5).add(0.5).toVar('maelstromSmoke')
    // Deeper down, bright filaments in currents of their own, sliding under the surface as the viewer moves.
    let deep: Vec3 = vec3(0)
    for (const [index, {depth, speed, light}] of layers.entries()) {
      const at = current(depth, speed).add(warp.mul(index + 1)).mul(vec3(34, 34, 50)).add(vec3(index * 7.1, 0, time.mul(0.12)))
      const filament = float(1).sub(mx_noise_float(at).abs().mul(6)).max(0).pow(3)
      deep = deep.add(mix(swirl, color('#147a6a'), index / (layers.length - 1)).mul(filament.mul(light)))
    }
    // The vortex on the nearest corner, turning one way on the top right and bottom left corners and the other way on the others.
    const corner = p.xy.sign()
    const center = corner.mul(surface.opening.add(middle))
    const spin = corner.x.mul(corner.y)
    const toward = p.xy.sub(center)
    const rho = toward.length().toVar('maelstromRho')
    const swirled = atan(toward.y, toward.x).add(float(0.03).div(rho.add(0.005)).mul(spin)).sub(time.mul(vortex.spin).mul(spin)).toVar('maelstromSwirl')
    const turbulence = mx_fractal_noise_float(vec3(vec2(swirled.cos(), swirled.sin()).mul(rho.mul(80)), time.mul(0.4)), 3).mul(0.5).add(0.5)
    const arms = swirled.mul(4).add(log(rho.add(0.002)).mul(9).mul(spin)).sin().mul(0.5).add(0.5).smoothstep(0.35, 0.9)
    // Dark and deep toward the eye, the swirl burning brightest toward the vortex’s rim, as in the fusion portal.
    const whirl = turbulence.mul(0.3).add(arms.mul(0.85)).clamp(0, 1).mul(rho.smoothstep(vortex.eye, vortex.radius * 0.7).mul(0.6).add(0.4))
    const pull = rho.smoothstep(vortex.radius, vortex.radius * 0.3).toVar('maelstromPull')
    // The eye lies deeper than the swirl, so it shifts against it as the viewer moves, and its rim wobbles.
    const eyeAt = below(vortex.depth).xy.sub(center)
    const eyeRho = eyeAt.length()
    const eyeAngle = atan(eyeAt.y, eyeAt.x)
    const edge = float(vortex.eye).mul(mx_noise_float(vec3(eyeAngle.cos().mul(2.2), eyeAngle.sin().mul(2.2), time.mul(1.1))).mul(0.25).add(1))
    const hole = eyeRho.smoothstep(edge, edge.mul(0.6)).mul(pull)
    const ring = eyeRho.sub(edge).abs().div(-0.0012).exp().add(eyeRho.sub(edge).abs().div(-0.005).exp().mul(0.35)).mul(pull)
    const pattern = mix(smoke, whirl, pull).toVar('maelstromPattern')
    const facing = normalView.dot(positionViewDirection.negate()).abs().clamp(0, 1)
    const sheen = facing.oneMinus().pow(2)
    const throb = time.mul(0.9).sin().mul(0.1).add(1)
    const bright: Float = pattern.smoothstep(0.35, 0.9).pow(1.5)
    const glow = mix(core, swirl, bright).mul(bright.mul(1.7).add(0.04)).add(rim.mul(bright.pow(4)).mul(0.7))
    this.colorNode = mix(color('#010a05'), color('#0a3a22'), pattern.mul(0.5)).mul(hole.oneMinus())
    this.emissiveNode = glow.add(deep.mul(pull.oneMinus()).mul(0.8)).add(swirl.mul(sheen.mul(0.35))).mul(throb).mul(hole.oneMinus()).add(rim.mul(ring.mul(2.6)))
    // The fluid dips into a funnel toward every eye, and its swirls ripple its surface.
    this.normalNode = heightNormal(pull.mul(pull).mul(-0.004).add(pattern.mul(0.0007)))
  }
}
