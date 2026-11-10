import {attribute, color, float, length, mix, mx_noise_float, smoothstep, time, uniform, vec3} from 'three/tsl'
import {DoubleSide, InstancedBufferAttribute, InstancedMesh, MeshBasicNodeMaterial, PlaneGeometry, Vector3} from 'three/webgpu'

import TransparentSpriteOutputsNode from '#src/lib/rendering/TransparentSpriteOutputsNode.ts'

import fountain, {jetLanding, sheetLanding} from './config.ts'

type Puff = {
  /** how far it drifts away from the axis, in m/s */
  drift: number
  /** how long it lives, in seconds */
  lifetime: number
  /** how thick the puff is at its brightest */
  opacity: number
  /** where the puff is born, in the fountain’s own space */
  origin: [number, number, number]
  /** how fast it rises, in m/s */
  rise: number
  /** how far it grows, in meters */
  size: number
}

const goldenAngle = Math.PI * (3 - Math.sqrt(5))
const goldenRatio = (Math.sqrt(5) - 1) / 2
const sequence = (i: number, seed: number) => (i * goldenRatio + seed) % 1

/**
 * Fine mist: soft puffs that rise, swell and fade where the veils strike the pools and where the ring jets break at their apex.
 *
 * Every puff is a camera-facing square drawn entirely on the GPU; no per-frame allocations, no textures. The puffs are deliberately faint, so they read as spray in the air rather than fog in the fountain.
 */
export function fountainMist(count = fountain.mistCount) {
  const rings = [
    {
      radius: sheetLanding(fountain.veils.lower),
      y: fountain.pools.basin,
      share: 0.3,
      size: 0.5,
    },
    {
      radius: sheetLanding(fountain.veils.middle),
      y: fountain.pools.lower,
      share: 0.22,
      size: 0.34,
    },
    {
      radius: sheetLanding(fountain.veils.cup),
      y: fountain.pools.middle,
      share: 0.16,
      size: 0.26,
    },
    {
      radius: jetLanding(fountain.ringJet),
      y: fountain.pools.basin,
      share: 0.32,
      size: 0.4,
    },
  ]
  const puffs: Array<Puff> = []
  for (let i = 0; i < count; i++) {
    const a = sequence(i, 0.19)
    const b = sequence(i * 5, 0.63)
    // Pick a ring by the share it gets of the mist budget.
    let chosen = rings.at(-1)!
    let offset = 0
    for (const ring of rings) {
      const slots = Math.round(count * ring.share)
      if (i - offset < slots) {
        chosen = ring
        break
      }
      offset += slots
    }
    const angle = i * goldenAngle
    const radius = chosen.radius + (b - 0.5) * 0.12
    puffs.push({
      origin: [Math.cos(angle) * radius, chosen.y + 0.02 + a * 0.1, Math.sin(angle) * radius],
      lifetime: 2.4 + b * 2.6,
      size: chosen.size * (0.55 + a * 0.9),
      rise: 0.12 + b * 0.3,
      drift: 0.02 + a * 0.06,
      opacity: 0.09 + b * 0.07,
    })
  }
  return puffs
}

/** A drifting veil of spray, as instanced billboards that fade in and out of the air. */
export default class LimestoneFountainMist extends InstancedMesh<PlaneGeometry, MeshBasicNodeMaterial> {
  private readonly cameraRight = uniform(new Vector3(1, 0, 0))
  private readonly cameraUp = uniform(new Vector3(0, 1, 0))

  constructor(count = fountain.mistCount) {
    const geometry = new PlaneGeometry(1, 1)
    const puffs = fountainMist(count)
    // A pipeline takes eight vertex buffers at most, so what every puff needs shares three of them.
    // origin, phase
    const origins = new Float32Array(count * 4)
    // lifetime, size, rise, drift
    const motions = new Float32Array(count * 4)
    const opacities = new Float32Array(count)
    for (const [i, puff] of puffs.entries()) {
      origins.set([...puff.origin, sequence(i * 7, 0.71)], i * 4)
      motions.set([puff.lifetime, puff.size, puff.rise, puff.drift], i * 4)
      opacities[i] = puff.opacity
    }
    geometry.setAttribute('mistOrigin', new InstancedBufferAttribute(origins, 4))
    geometry.setAttribute('mistMotion', new InstancedBufferAttribute(motions, 4))
    geometry.setAttribute('mistOpacity', new InstancedBufferAttribute(opacities, 1))
    const material = new MeshBasicNodeMaterial({
      color: '#f4fffd',
      depthWrite: false,
      side: DoubleSide,
      transparent: true,
    })
    material.name = 'Limestone fountain mist'
    // The soft puffs leave the geometry buffers of what is behind them alone, or the ambient occlusion would darken every quad to a blot.
    material.mrtNode = new TransparentSpriteOutputsNode
    super(geometry, material, count)
    this.name = 'fountain-mist'
    // The puffs are animated in the vertex node, so the plane’s own bounds mean nothing.
    this.frustumCulled = false
    const source = attribute<'vec3'>('position', 'vec3')
    const placed = attribute<'vec4'>('mistOrigin', 'vec4')
    const motion = attribute<'vec4'>('mistMotion', 'vec4')
    const lifetime = motion.x
    const progress = time.div(lifetime).add(placed.w).fract()
    const origin = placed.xyz
    const drift = motion.w.mul(progress).mul(lifetime)
    const size = motion.y.mul(progress.mul(0.9).add(0.35))
    // Billboard: the plane’s own axes follow the camera, in this mesh’s space, while every puff rises and drifts away from the axis.
    const corner = this.cameraRight.mul(source.x.mul(size)).add(this.cameraUp.mul(source.y.mul(size)))
    const rise = vec3(0, progress.mul(lifetime).mul(motion.z), 0)
    const outward = vec3(origin.x, 0, origin.z).normalize().mul(drift)
    material.positionNode = origin.add(corner).add(rise).add(outward)
    const radial = smoothstep(0.62, 0.12, length(source.xy))
    const wisps = mx_noise_float(vec3(source.x.mul(2.6), source.y.mul(2.6), time.mul(0.12))).mul(0.35).add(0.65)
    const life = progress.mul(float(1).sub(progress)).mul(4)
    material.opacityNode = radial.mul(wisps).mul(life).mul(attribute<'float'>('mistOpacity', 'float'))
    material.colorNode = mix(color('#dff7f2'), color('#ffffff'), wisps)
  }

  override dispose() {
    this.geometry.dispose()
    this.material.dispose()
    super.dispose()
  }

  override onBeforeRender(_renderer: unknown, _scene: unknown, camera: {matrixWorld: {elements: Array<number>}}) {
    // The fountain group only ever translates this mesh, so the camera’s world axes apply here unchanged.
    const elements = camera.matrixWorld.elements
    this.cameraRight.value.set(elements[0], elements[1], elements[2])
    this.cameraUp.value.set(elements[4], elements[5], elements[6])
  }
}
