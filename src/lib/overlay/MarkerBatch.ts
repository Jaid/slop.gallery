import type {Color, Node, Vector3} from 'three/webgpu'

import {attribute, cameraWorldMatrix, float, mix, positionGeometry, varying, vec4} from 'three/tsl'
import {DynamicDrawUsage, Float32BufferAttribute, InstancedBufferAttribute, InstancedBufferGeometry, Mesh, MeshBasicNodeMaterial} from 'three/webgpu'

/** Outer radius in units of the dot radius. The black rim and × have 75% opacity. */
const rim = 1.45
const coverage = (distance: Node<'float'>, edge: number) => float(edge).sub(distance).div(distance.fwidth().max(1e-6)).add(0.5).saturate()
const instances = (capacity: number) => {
  const buffer = new InstancedBufferAttribute(new Float32Array(capacity * 4), 4)
  return buffer.setUsage(DynamicDrawUsage)
}

/** One camera-facing quad per world-sized diagnostic marker. The camera that draws the overlay or capture determines its orientation. */
export default class MarkerBatch extends Mesh<InstancedBufferGeometry, MeshBasicNodeMaterial> {
  private readonly centers: InstancedBufferAttribute
  private readonly colors: InstancedBufferAttribute
  constructor(capacity: number) {
    const geometry = new InstancedBufferGeometry
    geometry.setIndex([0, 1, 2, 0, 2, 3])
    geometry.setAttribute('position', new Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3))
    const center = attribute<'vec4'>('centerRadius', 'vec4')
    const tint = attribute<'vec4'>('tintCross', 'vec4')
    const p = varying(positionGeometry.xy).mul(rim)
    const distance = p.length()
    const dot = coverage(distance, 1)
    // Perpendicular distance to the nearer diagonal, with a bar width of 0.22 dot radii.
    const diagonal = p.x.abs().sub(p.y.abs()).abs().mul(Math.SQRT1_2)
    const cross = coverage(diagonal, 0.11).mul(tint.w).mul(0.75)
    // Composite the translucent black × over both the dot and its translucent rim on the same quad.
    const opacity = mix(0.75, 1, dot).mul(cross.oneMinus()).add(cross)
    const material = new MeshBasicNodeMaterial({
      positionNode: center.xyz.add(cameraWorldMatrix.mul(vec4(positionGeometry.mul(center.w.mul(rim)), 0)).xyz),
      colorNode: tint.rgb.mul(dot).mul(cross.oneMinus()).div(opacity),
      opacityNode: coverage(distance, rim).mul(opacity),
    })
    super(geometry, material)
    this.frustumCulled = false
    geometry.instanceCount = 0
    this.centers = instances(capacity)
    this.colors = instances(capacity)
    geometry.setAttribute('centerRadius', this.centers)
    geometry.setAttribute('tintCross', this.colors)
  }
  setMarker(index: number, position: Vector3, radius: number, color: Color, crossed: boolean) {
    this.centers.setXYZW(index, position.x, position.y, position.z, radius)
    this.colors.setXYZW(index, color.r, color.g, color.b, Number(crossed))
  }
  show(count: number) {
    this.geometry.instanceCount = count
    this.centers.needsUpdate = true
    this.colors.needsUpdate = true
  }
}
