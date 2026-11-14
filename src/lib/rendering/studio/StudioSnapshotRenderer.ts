import type {Object3D} from 'three/webgpu'

import {Box3, PerspectiveCamera, RenderTarget, SRGBColorSpace, UnsignedByteType, Vector3} from 'three/webgpu'

import Studio from './base/Studio.ts'
import {averageLightness, backdropFor, frameObject, gray, snapshotFov, snapshotSize} from './studioSnapshot.ts'

export type StudioSnapshot = {
  /** WebP of the object on a neutral gray */
  image: Blob
  /** the average CIE lightness, 0–1, of the object’s pixels, if any were measured in time */
  lightness?: number
}

/** the direction from the object to the camera in its own frame: a three-quarter view from the front (+z), 32° to the right and 17° from above, so boxy objects show three faces */
const viewDirection = new Vector3(Math.sin(0.56) * Math.cos(0.3), Math.sin(0.3), Math.cos(0.56) * Math.cos(0.3))
/** the time in ms the lightness scan may take before the backdrop is chosen from what was sampled so far */
const lightnessBudgetMs = 10

/**
 * A studio that photographs objects of the scene: the object alone against a gray that contrasts with its average lightness, lit like the Knot billboards, framed to fill the middle 960 px of a 1024² WebP.
 *
 * The object is cloned and photographed upright in its own frame, like a product shot, not in whatever pose it tumbles through the room; its geometries and materials are shared, see {@link Studio}. Snapshots are taken one after another, as there is one scene and one target.
 */
export default class StudioSnapshotRenderer extends Studio {
  private readonly camera = new PerspectiveCamera(snapshotFov, 1, 0.01, 100)
  private readonly target = new RenderTarget(snapshotSize, snapshotSize, {
    type: UnsignedByteType,
    samples: 4,
  })

  constructor() {
    super()
    this.target.texture.colorSpace = SRGBColorSpace
    this.renderer.setSize(snapshotSize, snapshotSize, false)
  }

  protected override releaseResources() {
    this.target.dispose()
  }

  /** Photographs `object` in its own frame, front (+z) toward the camera. Rejects when the renderer is disposed, the object has no visible extent or the GPU reported an error. */
  async snapshot(object: Object3D): Promise<StudioSnapshot> {
    if (this.disposed) {
      throw new Error('The studio snapshot renderer has been disposed.')
    }
    return this.queue(() => this.capture(object))
  }

  private async capture(object: Object3D): Promise<StudioSnapshot> {
    await this.init()
    const subject = object.clone(true)
    subject.position.set(0, 0, 0)
    subject.scale.setScalar(1)
    subject.quaternion.identity()
    subject.updateMatrixWorld(true)
    const box = new Box3
    box.setFromObject(subject, true)
    if (box.isEmpty() || !Number.isFinite(box.min.lengthSq() + box.max.lengthSq())) {
      throw new Error(`${object.name || 'The object'} has no visible extent to photograph.`)
    }
    const center = box.getCenter(new Vector3)
    this.camera.position.copy(center).add(viewDirection)
    this.camera.lookAt(center)
    const position = frameObject(subject, this.camera.quaternion)
    if (!position) {
      throw new Error(`${object.name || 'The object'} has no vertices to photograph.`)
    }
    this.camera.position.copy(position)
    const distance = position.distanceTo(center)
    const extent = box.getSize(new Vector3).length()
    this.camera.near = Math.max(0.01, (distance - extent) / 2)
    this.camera.far = distance + extent
    this.camera.updateProjectionMatrix()
    this.stage.add(subject)
    this.errors.length = 0
    this.setTime(0)
    try {
      this.renderer.setOutputRenderTarget(this.target)
      this.renderer.setRenderTarget(this.target)
      await this.renderer.compileAsync(this.scene, this.camera)
      this.renderer.render(this.scene, this.camera)
      const pixels = await this.renderer.readRenderTargetPixelsAsync(this.target, 0, 0, snapshotSize, snapshotSize) as Uint8Array
      await this.device.queue.onSubmittedWorkDone()
      if (this.errors.length) {
        throw new Error(`${object.name || 'The object'}: ${this.errors.join('\n')}`)
      }
      // Rows of 4096 bytes are 256-byte aligned, so WebGPU reads back packed rows in ImageData orientation.
      if (pixels.byteLength !== snapshotSize * snapshotSize * 4) {
        throw new Error(`Unexpected WebGPU readback size: ${pixels.byteLength} bytes.`)
      }
      // A view, not a copy: the readback buffer is ours and never shared.
      const data = new Uint8ClampedArray(pixels.buffer as ArrayBuffer, pixels.byteOffset, pixels.byteLength)
      const lightness = averageLightness(data, snapshotSize, snapshotSize, {budgetMs: lightnessBudgetMs})
      const image = await this.encode(data, backdropFor(lightness))
      return {
        image,
        ...lightness === undefined ? {} : {lightness},
      }
    } finally {
      this.renderer.setOutputRenderTarget(null)
      this.renderer.setRenderTarget(null)
      this.stage.remove(subject)
    }
  }

  private async encode(pixels: Uint8ClampedArray<ArrayBuffer>, backdrop: number) {
    const canvas = new OffscreenCanvas(snapshotSize, snapshotSize)
    const context = canvas.getContext('2d')
    if (!context) {
      throw new Error('Could not create a 2D canvas context for the studio snapshot.')
    }
    const bitmap = await createImageBitmap(new ImageData(pixels, snapshotSize, snapshotSize))
    try {
      context.fillStyle = gray(backdrop)
      context.fillRect(0, 0, snapshotSize, snapshotSize)
      context.drawImage(bitmap, 0, 0)
    } finally {
      bitmap.close()
    }
    const image = await canvas.convertToBlob({
      type: 'image/webp',
      quality: 0.94,
    })
    if (image.type !== 'image/webp') {
      throw new Error('The browser could not encode the studio snapshot as WebP.')
    }
    return image
  }
}

/** the one studio of the page, created on the first snapshot and released after a minute without one, as its GPU device is only needed on the occasional throw */
let shared: {
  idle: ReturnType<typeof setTimeout> | undefined
  renderer: StudioSnapshotRenderer
} | undefined
const idleMs = 60_000

export async function snapshotObject(object: Object3D) {
  shared ??= {
    renderer: new StudioSnapshotRenderer,
    idle: undefined,
  }
  const studio = shared
  clearTimeout(studio.idle)
  try {
    return await studio.renderer.snapshot(object)
  } finally {
    studio.idle = setTimeout(() => {
      if (shared === studio) {
        shared = undefined
      }
      studio.renderer.dispose()
    }, idleMs)
  }
}
