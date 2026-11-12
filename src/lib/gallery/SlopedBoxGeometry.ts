import {BoxGeometry, BufferGeometry} from 'three/webgpu'

/** A closed slab with plumb ends. Slopes are vertical rise per meter along local +z; each cap can have its own slope. `skew` shifts x per meter along z, leaving the end faces parallel. */
export default class SlopedBoxGeometry extends BufferGeometry {
  constructor(width: number, height: number, depth: number, topSlope: number, bottomSlope = topSlope, skew = 0) {
    super()
    if (![width, height, depth].every(value => Number.isFinite(value) && value > 0) || ![topSlope, bottomSlope, skew].every(Number.isFinite) || height <= Math.abs(topSlope - bottomSlope) * depth / 2) {
      throw new RangeError('A sloped box needs finite slopes, positive dimensions and separated caps.')
    }
    const box = new BoxGeometry(width, height, depth)
    this.copy(box)
    box.dispose()
    const positions = this.getAttribute('position')
    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i)
      positions.setX(i, positions.getX(i) + positions.getZ(i) * skew)
      positions.setY(i, y + positions.getZ(i) * (y > 0 ? topSlope : bottomSlope))
    }
    this.computeVertexNormals()
    this.computeBoundingBox()
    this.computeBoundingSphere()
  }
}
