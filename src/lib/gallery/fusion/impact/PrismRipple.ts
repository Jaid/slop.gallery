import type {Vec3} from '../../types.ts'
import type {PortalPalette} from '../PortalCore.ts'
import type {Node, Object3D} from 'three/webgpu'

import {cameraProjectionMatrix, cameraViewMatrix, cos, exp, float, mix, modelWorldMatrix, positionGeometry, screenUV, select, sin, smoothstep, uniform, vec2, vec3, vec4, viewportTexture} from 'three/tsl'
import {Color, Matrix4, Mesh, MeshBasicNodeMaterial, PlaneGeometry} from 'three/webgpu'

import TransparentSpriteOutputsNode from '../../../rendering/TransparentSpriteOutputsNode.ts'
import {imagePoint} from './strike.ts'

/** how long the rings run, in seconds after the strike */
const length = 1.5
/** how far the rings run out at full size, in meters, where they fade out */
const reach = 3
/** how fast the rings run out at full size, in m/s */
const pace = reach / length
/** how far apart the rings are at full size, in meters */
const wavelength = 0.55
/** how quickly the rings die away behind the front, per meter */
const calming = 1.1
/** how far the rings bend the view at most at full size, in meters, as green sees it */
const bend = 0.12
/** how far red and blue are bent, as shares of how far green is */
const [red, blue] = [3, -1]
const offset = new Matrix4
const sized = new Matrix4
/** Where the camera sees `point` of the sheet, in the screen’s UV space around its middle. */
const project = (point: Node<'vec2'>) => {
  const clip = cameraProjectionMatrix.mul(cameraViewMatrix).mul(modelWorldMatrix.mul(vec4(point, 0, 1)))
  return clip.xy.div(clip.w).mul(vec2(0.5, -0.5))
}

/**
 * The ripple the strike that opens a fusion sends out over the hung portrait, its frame and the wall around it, from the point of the wall nearest the middle of what was thrown: broad rings, several following each other, run out 3 m within 1.5 s and split the view behind them into its colors like a prism, red bent furthest and blue least, staining it between the portal’s swirl and its rim along every ring, so an orb’s glow colors them too, and glowing faintly in those colors.
 * A sheet just in front of the work’s frame, left where it struck as the fusion tears the work away, that shows the view behind it bent and stained. Whatever stands in front of it, like a portrait thrown into the work, hides it. It draws from its own copy of the view right before the portal’s warp, which then bends the rippled view along with everything behind it, so whatever hides the ripple, like the work torn off its wall, hides it where the warp shows it, and before the portal’s quads, which blend over it.
 */
export default class PrismRipple extends Mesh<PlaneGeometry, MeshBasicNodeMaterial> {
  readonly uniforms = {
    /** seconds since the strike; below 0 or long after hides it */
    age: uniform(10),
    /** how much further the rings bend the view than their size would, as a share; rings shrunk to a third still bend it more than a third as far, so they show */
    bending: uniform(1),
    rim: uniform(new Color),
    /** how hard it struck, about 0.5–1.2 */
    strength: uniform(1),
    swirl: uniform(new Color),
  }

  constructor() {
    const material = new MeshBasicNodeMaterial({
      transparent: true,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    })
    material.name = 'impact-prism-ripple'
    material.mrtNode = new TransparentSpriteOutputsNode
    super(new PlaneGeometry(reach * 2, reach * 2), material)
    this.name = 'impact-prism-ripple'
    const {age, bending, rim, strength, swirl} = this.uniforms
    // in meters from where it struck, at full size
    const local = positionGeometry.xy.toVar('rippleLocal')
    const distance = local.length().toVar('rippleDistance')
    const outward = local.div(distance.max(0.001))
    const behind = age.mul(pace).sub(distance)
    // A train of rings behind the front, dying away behind it and over time, gone by the end.
    const amplitude = smoothstep(-0.02, 0.03, behind).mul(exp(behind.max(0).mul(-calming))).mul(exp(age.mul(-1.5))).mul(smoothstep(length, length * 0.6, age)).mul(strength)
    const phase = behind.mul(Math.PI * 2 / wavelength)
    const bent = outward.mul(sin(phase).mul(amplitude).mul(bend).mul(bending))
    const view = viewportTexture()
    /** the view behind the point as if the sheet bent it `by` meters along it */
    const seen = (by: Node<'vec2'>) => view.sample(screenUV.add(project(local.add(by)).sub(project(local))).clamp(0, 1))
    const parted = vec3(seen(bent.mul(red)).r, seen(bent).g, seen(bent.mul(blue)).b)
    // Stained between the portal’s swirl and its rim along every ring, brightening on one flank and darkening on the other, and glowing faintly in them.
    const tint = mix(swirl, rim, sin(phase).mul(0.5).add(0.5))
    const stained = parted.mul(mix(vec3(1), tint.mul(1.7), amplitude.mul(1.4).min(0.7)))
    material.colorNode = stained.mul(float(1).add(cos(phase).mul(amplitude).mul(0.4))).add(tint.mul(amplitude).mul(0.16))
    material.opacityNode = amplitude.mul(14).clamp(0, 1).mul(smoothstep(reach, reach * 0.85, distance)).mul(select(age.greaterThan(0), float(1), float(0)))
    this.frustumCulled = false
    // Placed in the world by place(), whatever holds it.
    this.matrixAutoUpdate = false
    this.matrixWorldAutoUpdate = false
    // Right before the portal’s warp, at -1.
    this.renderOrder = -2
  }

  dispose() {
    this.geometry.dispose()
    this.material.dispose()
  }

  /** Colors the rings in the portal’s colors. */
  paint({rim, swirl}: PortalPalette) {
    this.uniforms.rim.value.copy(rim)
    this.uniforms.swirl.value.copy(swirl)
  }

  /** Lays the rings out from the point nearest the world’s `point` in front of the hung portrait whose group is `work`, `front` in front of its middle, as far as its frame reaches, as the work hangs now, and as hard as `strength` (0.55–1.2) says, shrunk evenly to reach `radius` meters at most, the rings and their spacing alike, at the same pace in time, while how far they bend the view only follows the square root of that, so small rings still show; at full size without one. */
  place(work: Object3D, front: number, point: Vec3, strength: number, radius = reach) {
    const [x, y] = imagePoint(work, point)
    const scale = radius / reach
    this.uniforms.bending.value = 1 / Math.sqrt(scale)
    this.uniforms.strength.value = strength
    this.matrixWorld.copy(work.matrixWorld).multiply(offset.makeTranslation(x, y, front + 0.003)).multiply(sized.makeScale(scale, scale, 1))
  }

  /** Shows the rings `age` seconds after the strike, hiding them once they calmed down. */
  update(age: number) {
    const playing = age >= 0 && age < length
    this.visible = playing
    this.uniforms.age.value = playing ? age : 10
  }
}
