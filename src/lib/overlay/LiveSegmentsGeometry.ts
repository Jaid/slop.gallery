import {LineSegmentsGeometry} from 'three/addons/lines/LineSegmentsGeometry.js'
import {InstancedInterleavedBuffer, InterleavedBufferAttribute, Sphere} from 'three/webgpu'

/** Each block holds pairs of xyz endpoints. Return the same immutable block to keep its GPU data on the next draw. */
export type LiveSegments = {
  dispose?: () => void
  read: () => ReadonlyArray<Float32Array>
}

/** Packs a producer’s blocks into one draw, uploading only the blocks that changed or moved in the buffer. */
export default class LiveSegmentsGeometry extends LineSegmentsGeometry {
  private previous: ReadonlyArray<Float32Array> = []
  private source?: LiveSegments
  constructor(source: LiveSegments) {
    super()
    this.source = source
    this.allocate(1)
    this.instanceCount = 0
    // The producer’s endpoints can move anywhere. The mesh skips frustum culling, but Three still asks for its center when sorting.
    this.boundingSphere = new Sphere
  }
  override dispose() {
    super.dispose()
    this.source?.dispose?.()
    this.source = undefined
    this.previous = []
    this.deleteAttribute('instanceStart')
    this.deleteAttribute('instanceEnd')
  }
  update() {
    if (!this.source) {
      return
    }
    const blocks = this.source.read()
    let count = 0
    for (const block of blocks) {
      if (block.length % 6) {
        throw new RangeError('Overlay segments need pairs of xyz endpoints.')
      }
      count += block.length / 6
    }
    let buffer = (this.getAttribute('instanceStart') as InterleavedBufferAttribute).data
    if (count > buffer.count) {
      // WebGPU buffers cannot grow in place. Release the old attributes before replacing them, keeping the producer.
      super.dispose()
      buffer = this.allocate(2 ** Math.ceil(Math.log2(count)))
      this.previous = []
    }
    let offset = 0
    let previousOffset = 0
    for (const [i, block] of blocks.entries()) {
      if (block.length && (block !== this.previous[i] || offset !== previousOffset)) {
        buffer.array.set(block, offset)
        buffer.addUpdateRange(offset, block.length)
        buffer.needsUpdate = true
      }
      offset += block.length
      previousOffset += this.previous[i]?.length ?? 0
    }
    this.instanceCount = count
    this.previous = blocks
  }
  private allocate(count: number) {
    // Three uploads DynamicDrawUsage even when no block changed. Explicit versions and ranges keep the retained prefix on the GPU.
    const buffer = new InstancedInterleavedBuffer(new Float32Array(count * 6), 6, 1)
    this.setAttribute('instanceStart', new InterleavedBufferAttribute(buffer, 3, 0))
    this.setAttribute('instanceEnd', new InterleavedBufferAttribute(buffer, 3, 3))
    return buffer
  }
}
