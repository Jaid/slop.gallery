import type {OrbGlassOptions, OrbRay} from '../base/OrbGlassMaterial.ts'
import type {Node} from 'three/webgpu'

import {atan, color, cross, float, mix, mx_noise_float, mx_noise_vec3, normalize, smoothstep, time, vec2, vec3} from 'three/tsl'

import OrbGlassMaterial from '../base/OrbGlassMaterial.ts'
import {coverage, spinAroundY} from '../lib/fill.ts'
import {orbFractalNoise, orbNoise} from '../lib/noise.ts'

const steps = 40
/** the eyeball’s radius, in radii of the orb */
const eyeRadius = 0.43
/** how far the iris and the pupil reach from the middle of the gaze, as the cosine of their angle */
const irisEdge = Math.cos(0.5)
const scleraColor = color('#e6d6b4')
const veinColor = color('#9a0d12')
const irisInner = color('#d9a21e')
const irisOuter = color('#3f7a1f')
const limbusColor = color('#120a04')
const bloodColor = color('#a8060f')
const clotColor = color('#260104')
/** where the blood in the liquid is at a point: its thick clouds, the thin tendrils curling off their edges and the warp that bends both, which the trail from the eye shares */
function ink(point: Node<'vec3'>) {
  // The liquid turns slowly, faster toward the middle, so the smears wind into one another.
  const swirled = spinAroundY(point, time.mul(0.1).add(point.length().oneMinus().mul(0.9)))
  const flow = swirled.mul(1.8).add(vec3(0, time.mul(0.06), 0))
  const warp = orbNoise(flow.mul(0.7).add(vec3(0, 0, time.mul(0.05)))).xyz.toVar()
  const q = flow.add(warp.mul(0.8))
  const body = orbFractalNoise(q, 3, 2.1)
  return {
    clouds: body.smoothstep(0.04, 0.26),
    tendrils: float(1).sub(orbNoise(q.mul(3.2).add(7.1)).w.abs().mul(10)).max(0).pow(3).mul(body.smoothstep(-0.12, 0.12)),
    warp,
  }
}

/** A jaundiced, bloodshot eye floating in liquid it bleeds into: dark red smears of blood drift and curl through the glass like ink in water, a trail sinks from behind the eye and a clot settles at the bottom. The eye turns to stare at whoever looks into the glass, darting about now and then, its pupil widening as they come closer. */
export default class EyeOrbMaterial extends OrbGlassMaterial {
  constructor(options: OrbGlassOptions) {
    super(options, {
      name: 'orb-eye',
      tint: '#c08070',
    })
  }

  protected override fill(ray: OrbRay) {
    const {origin, direction, eye} = ray
    // It bobs gently in the liquid.
    const center = vec3(time.mul(0.7).sin().mul(0.03), time.mul(0.9).sin().mul(0.04), 0).toVar('eyeCenter')
    // It stares at the camera, but glances away now and then, quickly, like a real eye.
    const glance = time.mul(0.45).floor()
    const darting = mx_noise_vec3(vec3(glance.mul(3.1), 0.5, 0.5)).mul(smoothstep(0.55, 0.8, mx_noise_float(vec3(glance.mul(1.7), 2.5, 0.5)).mul(0.5).add(0.5)))
    const gaze = normalize(eye.sub(center).normalize().add(darting.mul(0.55))).toVar('eyeGaze')
    const toCenter = center.sub(origin)
    const approach = toCenter.dot(direction)
    const miss = origin.add(direction.mul(approach)).sub(center).length()
    const depth = approach.sub(float(eyeRadius * eyeRadius).sub(miss.mul(miss)).max(0).sqrt())
    const normal = origin.add(direction.mul(depth)).sub(center).normalize().toVar('eyeNormal')
    const facing = normal.dot(gaze)
    // In the iris’ own frame: how far around it, and how far out, 0 in the middle and 1 at its edge.
    const side = normalize(cross(gaze, vec3(0, 1, 0.001)))
    const upward = cross(side, gaze)
    const angle = atan(normal.dot(upward), normal.dot(side))
    const radial = float(1).sub(facing).div(1 - irisEdge).sqrt()
    // The pupil widens as the viewer comes close.
    const closeness = smoothstep(9, 4, eye.length())
    const pupil = closeness.mul(0.22).add(0.3).add(time.mul(1.3).sin().mul(0.02))
    const around = vec3(angle.cos(), angle.sin(), 0)
    const fibers = mx_noise_float(around.mul(7).add(vec3(0, 0, radial.mul(1.5)))).mul(0.5).add(0.5)
    const crypts = mx_noise_float(around.mul(3).add(vec3(0, 0, radial.mul(5).add(4.1)))).smoothstep(0.2, 0.6)
    const irisColor = mix(irisInner, irisOuter, radial.smoothstep(0.35, 0.9)).mul(fibers.mul(0.8).add(0.4)).mul(crypts.mul(-0.4).add(1))
    const irisRim = radial.smoothstep(0.8, 1)
    // The iris glows faintly from within, so it catches the eye even from across the room.
    const iris = mix(irisColor.mul(radial.smoothstep(0.9, 0.3).mul(2.5).add(1)), limbusColor, irisRim)
    // Veins creep in from the back of the eye, thickest where they start.
    // Two webs of thin vessels, the coarse one reaching closer to the iris.
    const veinPoint = normal.mul(2.4).add(mx_noise_vec3(normal.mul(1.7)).mul(0.35))
    const trunks = float(1).sub(mx_noise_float(veinPoint).abs().mul(14)).max(0).pow(2).mul(smoothstep(0.92, 0.35, facing))
    const branches = float(1).sub(mx_noise_float(veinPoint.mul(2.6).add(3.7)).abs().mul(16)).max(0).pow(2).mul(smoothstep(0.7, 0.1, facing))
    const veins = trunks.add(branches.mul(0.8))
    const blush = smoothstep(0.95, -0.4, facing).mul(0.6)
    const sclera = mix(mix(scleraColor, veinColor, blush), veinColor.mul(0.7), veins.clamp(0, 1))
    const irisMask = coverage(facing.sub(irisEdge))
    const pupilMask = coverage(pupil.sub(radial)).mul(irisMask)
    const surface = mix(mix(sclera, iris, irisMask), vec3(0.004), pupilMask)
    // Lit from the viewer’s side, with a wet highlight.
    const light = normal.dot(direction.negate()).max(0).mul(0.75).add(0.25)
    const wet = normal.dot(normalize(direction.negate().add(vec3(0.3, 0.6, 0)))).max(0).pow(80).mul(4)
    const eyeLayer = {
      depth,
      coverage: coverage(float(eyeRadius).sub(miss)),
      color: surface.mul(light).mul(1.3).add(vec3(wet)),
    }
    // It bleeds from behind, where the nerve would be torn off.
    const wound = center.sub(gaze.mul(eyeRadius * 0.85)).toVar('eyeWound')
    return this.march(ray, steps, point => {
      const {clouds, tendrils, warp} = ink(point)
      // A ribbon sinking from the wound, widening as it falls and bent by the same currents.
      const below = point.sub(wound)
      const fallen = below.y.negate().max(0)
      const spread = fallen.mul(0.3).add(0.04)
      const ribbon = vec2(below.x.add(warp.x.mul(fallen.mul(0.4))), below.z.add(warp.z.mul(fallen.mul(0.4)))).length()
      const trail = smoothstep(spread, spread.mul(0.35), ribbon).mul(smoothstep(0.05, -0.2, below.y))
      // What has sunk settles into a clot at the bottom.
      const clot = smoothstep(-0.74, -0.9, point.y.add(warp.y.mul(0.05)))
      // The smears gather in the liquid between the eye and the glass, where they drift across the eye’s face.
      const distance = point.sub(center).length()
      const shell = smoothstep(eyeRadius, eyeRadius + 0.06, distance).mul(smoothstep(0.98, 0.86, point.length()))
      const blood = clouds.mul(shell).max(trail).max(clot).add(tendrils.mul(shell).mul(0.5)).toVar()
      // Thin blood glows red where the light comes through; thick blood is nearly black.
      const lit = smoothstep(-1, 1, point.y).mul(0.7).add(0.55)
      return {
        absorption: float(0.12).add(blood.mul(4)),
        density: blood.mul(8),
        color: mix(bloodColor, clotColor, blood.smoothstep(0.15, 0.9)).mul(lit),
      }
    }, [eyeLayer])
  }
}
