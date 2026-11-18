import {BufferGeometry, ExtrudeGeometry, Float32BufferAttribute, Shape, ShapeGeometry} from 'three/webgpu'

import salon, {salonCeiling, salonSkylight, salonSkylightOuterScale} from './salon.ts'

const point = (angle: number, scale = 1) => {
  const {lobeDepth, lobes, opening} = salonSkylight
  const ripple = 1 - lobeDepth * (1 - Math.cos(angle * lobes)) / 2
  return [Math.cos(angle) * opening[0] / 2 * scale * ripple, Math.sin(angle) * opening[1] / 2 * scale * ripple] as const
}

/** A point on the gently lobed glazing perimeter. */
export function salonSkylightPoint(angle: number, scale = 1) {
  return point(angle, scale)
}

/** The solid ceiling slab, with the same lobed hole as the lantern well. */
export function salonCeilingSlabGeometry() {
  const shape = new Shape
  const [width, depth] = salon.size
  shape.moveTo(-width / 2, -depth / 2)
  shape.lineTo(width / 2, -depth / 2)
  shape.lineTo(width / 2, depth / 2)
  shape.lineTo(-width / 2, depth / 2)
  shape.closePath()
  shape.holes.push(outline(salonSkylightOuterScale))
  return new ExtrudeGeometry(shape, {
    bevelEnabled: false,
    depth: salonCeiling.thickness,
    curveSegments: 1,
  })
}

/** A shallow, flared plaster reveal between the ceiling and the glazed rosette. */
export function salonSkylightWellGeometry() {
  const {depth, segments} = salonSkylight
  const outerScale = salonSkylightOuterScale
  const profiles = [[outerScale * 1.015, salonCeiling.underside + 0.005], [1.12, salonCeiling.underside - depth * 0.42], [1, salonCeiling.underside - depth]] as const
  const positions: Array<number> = []
  const indices: Array<number> = []
  for (const [scale, y] of profiles) {
    for (let i = 0; i < segments; i++) {
      const [x, z] = point(i / segments * Math.PI * 2, scale)
      positions.push(x, y, z)
    }
  }
  for (let row = 0; row < profiles.length - 1; row++) {
    for (let i = 0; i < segments; i++) {
      const next = (i + 1) % segments
      const a = row * segments + i
      const b = row * segments + next
      const c = (row + 1) * segments + i
      const d = (row + 1) * segments + next
      indices.push(a, b, c, b, d, c)
    }
  }
  const geometry = new BufferGeometry
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

/** A single horizontal glass surface over the opening, with metric UVs for its cast-glass shader. */
export function salonSkylightGlassGeometry() {
  const geometry = new ShapeGeometry(outline(1))
  const positions = geometry.getAttribute('position')
  const uv = geometry.getAttribute('uv')
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, positions.getX(i), positions.getY(i))
  }
  geometry.rotateX(-Math.PI / 2)
  return geometry
}

function outline(scale: number) {
  const path = new Shape
  const first = point(0, scale)
  path.moveTo(first[0], first[1])
  for (let i = 1; i <= salonSkylight.segments; i++) {
    const [x, y] = point(i / salonSkylight.segments * Math.PI * 2, scale)
    path.lineTo(x, y)
  }
  path.closePath()
  return path
}
