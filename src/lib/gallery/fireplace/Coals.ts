import hsl from 'okhsl'
import {attribute, color, float, mix, mx_noise_float, positionGeometry, smoothstep, time, vec3} from 'three/tsl'
import {IcosahedronGeometry, InstancedBufferAttribute, InstancedMesh, Matrix4, MeshStandardNodeMaterial, Quaternion, Vector3} from 'three/webgpu'

import fireColor from '../../materials/fireColor.ts'
import fire from './config.ts'

type Coal = {
  /** 0 = burnt-out cinder at the rim, 1 = in the heart of the fire */
  heat: number
  position: [number, number, number]
  rotation: [number, number, number, number]
  scale: [number, number, number]
  seed: number
}

const goldenAngle = Math.PI * (3 - Math.sqrt(5))
const goldenRatio = (Math.sqrt(5) - 1) / 2
/** deterministic, evenly spread pseudo-random fractions */
const sequence = (i: number, seed: number) => (i * goldenRatio + seed) % 1

/** Whether a point on the bed is clear of the burning logs’ footprints. */
export function clearOfLogs(x: number, z: number) {
  return fire.pile.filter(log => log.inward !== 0).every(({position, yaw, shape}) => {
    // The log axis runs along (−cos yaw, 0, sin yaw).
    const dx = x - position[0]
    const dz = z - position[2]
    const along = -dx * Math.cos(yaw) + dz * Math.sin(yaw)
    const across = Math.abs(dx * Math.sin(yaw) + dz * Math.cos(yaw))
    return across > shape.radiusBottom * 0.8 || Math.abs(along) > shape.length / 2
  })
}

/**
 * Lumps of charcoal heaped on the ember bed: a sunflower spiral over the bed’s ellipse, so they spread evenly without clumping, hotter toward the middle.
 *
 * None of them sits inside a log; the spiral is just dense enough that `count` spots remain beside the logs.
 */
export function fireCoals(count = fire.coals.count) {
  for (let spots = count; ; spots++) {
    const coals = spiral(spots)
    if (coals.length >= count) {
      return coals.slice(0, count)
    }
  }
}

function spiral(spots: number) {
  const [width, depth] = fire.embers.size
  const coals: Array<Coal> = []
  const rotation = new Quaternion
  for (let i = 0; i < spots; i++) {
    const a = sequence(i, 0.31)
    const b = sequence(i * 7, 0.77)
    const c = sequence(i * 11, 0.13)
    // Stay inside the dark part of the bed; beyond it, lone lumps on the pale hearth look like gravel.
    const r = Math.sqrt((i + 0.5) / spots) * 0.78
    const angle = i * goldenAngle
    const x = Math.cos(angle) * r * width / 2
    const z = Math.sin(angle) * r * depth / 2
    if (!clearOfLogs(x, z)) {
      continue
    }
    const size = 0.03 + b * 0.035
    const axis = new Vector3(a - 0.5, 1, c - 0.5)
    rotation.setFromAxisAngle(axis.normalize(), b * Math.PI * 2)
    coals.push({
      position: [x, fire.embers.y + size * 0.25, z],
      rotation: rotation.toArray(),
      scale: [size * (1 + a * 0.5), size * (0.55 + c * 0.25), size * (1.2 - a * 0.3)],
      heat: (1 - r ** 2 * 1.1) * (0.65 + c * 0.35),
      seed: sequence(i * 3, 0.59),
    })
  }
  return coals
}

/**
 * Glowing coals as one instanced mesh. Each lump is crusted with gray ash where it has cooled; its hot flanks glow through cracks and breathe slowly with the draft.
 */
export default class Coals extends InstancedMesh<IcosahedronGeometry, MeshStandardNodeMaterial> {
  constructor(count = fire.coals.count) {
    const geometry = new IcosahedronGeometry(1, 1)
    const coals = fireCoals(count)
    const parameters = new Float32Array(coals.length * 2)
    for (const [i, {heat, seed}] of coals.entries()) {
      parameters.set([heat, seed], i * 2)
    }
    geometry.setAttribute('coal', new InstancedBufferAttribute(parameters, 2))
    const material = new MeshStandardNodeMaterial({
      roughness: 0.9,
      envMapIntensity: 0,
    })
    material.name = 'lodge-coal'
    const coal = attribute<'vec2'>('coal', 'vec2')
    const seed = coal.y.mul(53)
    const crust = mx_noise_float(positionGeometry.mul(3.2).add(seed)).mul(0.5).add(0.5)
    const breath = mx_noise_float(vec3(seed, time.mul(0.35), float(0))).mul(0.5).add(0.5)
    // Cracks open up where the crust is thin; underneath, the coal glows.
    const cracks = smoothstep(0.3, 0.55, crust).oneMinus()
    const heat = coal.x.mul(breath.mul(0.5).add(0.5)).mul(cracks.mul(0.6).add(0.25))
    const ash = smoothstep(0.5, 0.85, crust).mul(coal.x.oneMinus().mul(0.6).add(0.25))
    material.colorNode = mix(color(hsl.integer(57, 22, 6)), color(hsl.integer(68, 7, 31)), ash)
    material.emissiveNode = fireColor(heat).mul(2)
    super(geometry, material, coals.length)
    this.name = 'lodge-coals'
    const matrix = new Matrix4
    for (const [i, {position, rotation, scale}] of coals.entries()) {
      this.setMatrixAt(i, matrix.compose(new Vector3(...position), new Quaternion(...rotation), new Vector3(...scale)))
    }
    this.instanceMatrix.needsUpdate = true
    this.computeBoundingSphere()
    this.receiveShadow = true
  }

  override dispose() {
    this.geometry.dispose()
    this.material.dispose()
    super.dispose()
  }
}
