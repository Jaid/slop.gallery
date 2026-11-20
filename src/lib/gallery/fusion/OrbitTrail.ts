import type {PortalFrame} from './portalFrame.ts'
import type {Node} from 'three/webgpu'

import {cameraPosition, cos, cross, exp, float, fract, mix, mx_noise_float, positionGeometry, sin, smoothstep, uniform, uv, vec3} from 'three/tsl'
import {AdditiveBlending, Color, Mesh, MeshBasicNodeMaterial, PlaneGeometry, Vector3} from 'three/webgpu'

import TransparentSpriteOutputsNode from '../../rendering/TransparentSpriteOutputsNode.ts'

/** how wide the ribbon its strands coil within is at a width of 1, in meters */
const breadth = 0.78
/** its strands’ colors: sapphire, coral and gold */
const jewels = [[0.08, 0.42, 1.65], [1.7, 0.36, 0.12], [1.35, 1.1, 0.38]] as const
const toHead = new Vector3
/** a bell curve over `distance`, 1 at 0 and about 0.37 at `size` */
const bell = (distance: Node<'float'>, size: Node<'float'> | number) => {
  const scaled = distance.div(size)
  return exp(scaled.mul(scaled).negate())
}

/**
 * A braid of silk that something leaves behind as it whips around a fusion’s portal, lying on the orbit’s tilted ellipse: three fine strands share one root at its head and coil around it as a helix, thick and bright where they pass in front, hair-thin and dim behind, the near ones shadowing the far ones where they cross. Beads of light run down each strand, and toward the tail every strand frays into filaments that drift apart and flutter, over a faint, flickering ember in the portal’s colors. Long enough, two of them close into a ring of silk.
 * A ribbon turned toward the camera along its length, laid out in world space by the vertex shader from the orbit’s frame, so the mesh stays at the scene’s origin.
 */
export default class OrbitTrail extends Mesh<PlaneGeometry, MeshBasicNodeMaterial> {
  readonly uniforms = {
    /** along the wall and across it, the orbit’s semi-axes in meters */
    along: uniform(1),
    across: uniform(1),
    /** the orbit angle of its head, in radians */
    angle: uniform(0),
    /** the portal’s middle */
    center: uniform(new Vector3),
    /** seconds, which drive its coiling and its flicker */
    clock: uniform(0),
    /** how brightly it glows; 0 hides it */
    energy: uniform(0),
    /** how many radians of the orbit it covers behind its head */
    length: uniform(0),
    /** out of the wall */
    normal: uniform(new Vector3(0, 0, 1)),
    /** how far out on the orbit it lies, 1 on it and 0 in the portal’s middle */
    reach: uniform(1),
    rim: uniform(new Color),
    /** how much farther out than its head its tail lies, as a share of the head’s reach, which winds it into a spiral */
    spiral: uniform(0),
    swirl: uniform(new Color),
    /** along the wall */
    tangent: uniform(new Vector3(1, 0, 0)),
    /** how much higher than the portal the orbit passes on the wall’s side */
    tilt: uniform(0),
    /** how thick it is, about 1 */
    width: uniform(1),
  }

  constructor(seed: number) {
    const material = new MeshBasicNodeMaterial({
      transparent: true,
      depthWrite: false,
      fog: false,
      toneMapped: false,
    })
    material.blending = AdditiveBlending
    material.name = 'fusion-orbit-trail'
    material.mrtNode = new TransparentSpriteOutputsNode
    super(new PlaneGeometry(1, 1, 128, 1), material)
    this.name = 'fusion-orbit-trail'
    const {across, along, angle, center, clock, energy, length, normal, reach, rim, spiral, swirl, tangent, tilt, width} = this.uniforms
    // A uniform rather than a constant, so every trail shares one pipeline.
    const offset = uniform(seed)
    // 0 at its tail, 1 at its head
    const share = positionGeometry.x.add(0.5)
    const theta = angle.sub(length.mul(float(1).sub(share)))
    const up = vec3(0, 1, 0)
    /** the point of the orbit at `turn` radians, like `orbitPoint` */
    const point = (turn: Node<'float'>) => center.add(tangent.mul(along.mul(cos(turn))).add(normal.mul(across.mul(sin(turn)))).sub(up.mul(tilt.mul(sin(turn)))).mul(reach.mul(spiral.mul(float(1).sub(share)).add(1))))
    const base = point(theta)
    const direction = tangent.mul(along.mul(sin(theta)).negate()).add(normal.mul(across.mul(cos(theta)))).sub(up.mul(tilt.mul(cos(theta)))).normalize()
    // Across the trail, so that its front faces the camera.
    const side = cross(cameraPosition.sub(base), direction).normalize()
    // It thins toward its tail.
    const thickness = width.mul(share.mul(0.65).add(0.35))
    material.positionNode = base.add(side.mul(positionGeometry.y.mul(thickness).mul(breadth)))
    const lengthwise = uv().x
    /** across the ribbon, from −0.5 to 0.5 */
    const fiber = uv().y.sub(0.5)
    // The helix opens from its head and turns as it streams back.
    const spread = float(1).sub(lengthwise.pow(1.6)).mul(0.33)
    const coil = lengthwise.mul(12).sub(clock.mul(6.5)).add(offset)
    const frayed = smoothstep(0.6, 0.05, lengthwise)
    const strands = jewels.map((jewel, index) => {
      const turn = coil.add(index * Math.PI * 2 / 3)
      /** 1 toward the camera, 0 away from it */
      const near = cos(turn).mul(0.5).add(0.5)
      const apart = fiber.sub(sin(turn).mul(spread))
      const girth = near.mul(0.007).add(0.006)
      const stray = frayed.mul(sin(lengthwise.mul(41).sub(clock.mul(9)).add(index * 1.9)).mul(0.25).add(1)).mul(0.04)
      const filaments = bell(apart, girth).add(bell(apart.sub(stray), girth.mul(0.6)).add(bell(apart.add(stray.mul(0.8)), girth.mul(0.6))).mul(frayed).mul(0.55))
      const bead = bell(fract(lengthwise.mul(3).add(clock.mul(1.5)).add(index / 3)).sub(0.5), 0.035)
      return {
        /** how much of what lies behind it it hides, 0–1 */
        cover: bell(apart, girth.mul(1.8)),
        light: vec3(...jewel).mul(filaments.add(bell(apart, 0.045).mul(0.2)).add(bell(apart, 0.03).mul(bead).mul(2.4))).add(vec3(1, 0.95, 0.85).mul(bell(apart, 0.016)).mul(bead).mul(1.6)).mul(near.pow2().mul(0.8).add(0.2)),
        near,
      }
    })
    let braid: Node<'vec3'> = vec3(0)
    for (const strand of strands) {
      let lit: Node<'float'> = float(1)
      for (const other of strands) {
        if (other !== strand) {
          lit = lit.mul(float(1).sub(other.cover.mul(smoothstep(0, 0.3, other.near.sub(strand.near))).mul(0.9)))
        }
      }
      braid = braid.add(strand.light.mul(lit))
    }
    // Its glow grows ever slower with its energy, so the strands keep their colors instead of burning white.
    const glow = energy.div(energy.mul(0.3).add(1)).mul(3.57)
    // The ember under the strands: hottest at the head, fraying and flickering toward the tail.
    const flicker = mx_noise_float(vec3(theta.mul(4), clock.mul(5), offset)).mul(0.5).add(0.5)
    const fray = smoothstep(0.15, 0.85, flicker.add(lengthwise.mul(0.7)))
    const core = bell(fiber, 0.048).mul(1.4).add(bell(fiber, 0.152).mul(0.45))
    const heat = lengthwise.pow(1.6)
    const ember = mix(swirl, rim, heat).add(vec3(heat.pow(4).mul(0.8))).mul(core).mul(fray).mul(heat.mul(0.85).add(0.15)).mul(smoothstep(0, 0.12, lengthwise)).mul(energy).mul(0.176)
    material.colorNode = braid.mul(glow).mul(lengthwise.mul(0.62).add(0.38)).mul(smoothstep(0, 0.09, lengthwise)).add(ember)
    material.opacityNode = float(1)
    // The vertex shader lays out the ribbon, so the source quad’s bounds say nothing.
    this.frustumCulled = false
  }

  dispose() {
    this.geometry.dispose()
    this.material.dispose()
  }

  /** Lays it on the orbit of `frame`, its head where `head` is and `reach` times as far out from the portal’s middle. */
  follow({center, normal, orbit, tangent}: PortalFrame, head: Vector3, reach: number) {
    const {uniforms} = this
    uniforms.along.value = orbit.along
    uniforms.across.value = orbit.across
    uniforms.tilt.value = orbit.tilt
    uniforms.center.value.fromArray(center)
    uniforms.tangent.value.fromArray(tangent)
    uniforms.normal.value.fromArray(normal)
    toHead.subVectors(head, uniforms.center.value)
    const x = toHead.dot(uniforms.tangent.value) / orbit.along
    const z = toHead.dot(uniforms.normal.value) / orbit.across
    uniforms.angle.value = Math.atan2(z, x)
    uniforms.reach.value = Math.hypot(x, z) * reach
  }
}
