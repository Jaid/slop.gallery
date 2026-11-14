import type {ArtworkHolder} from '../../src/lib/gallery/PortraitModel.ts'
import type {Mesh, MeshBasicNodeMaterial} from 'three/webgpu'

import {describe, expect, mock, test} from 'bun:test'

import {Box3, Texture, Vector3} from 'three/webgpu'

import {maximumFrameReach} from '../../src/frames/base/PortraitFrame.ts'
import {classicFrame, frames} from '../../src/frames/index.ts'
import PortraitModel from '../../src/lib/gallery/PortraitModel.ts'
import {subjectRadius} from '../../src/lib/rendering/studio/studioFraming.ts'
import {artworkPlaceholders} from '../../src/lib/useArtworkTexture.ts'

/** What stands in for the textures the artworks share: one texture per test, with what was released. */
const artwork = (texture: Promise<Texture> = Promise.resolve(new Texture)) => {
  const release = mock(() => {})
  const hold = mock<ArtworkHolder>(() => ({
    texture,
    release,
  }))
  return {
    hold,
    release,
  }
}
const work = {
  width: 2.4,
  height: 1.6,
  source: '/art/goose.jxl',
}
const meshes = (model: PortraitModel) => {
  const found = new Map<string, Mesh>
  model.object.traverse(child => {
    if ('isMesh' in child) {
      found.set(child.name, child as Mesh)
    }
  })
  return {
    frame: found.get('portrait-frame')!,
    image: found.get('portrait-image')! as Mesh<Mesh['geometry'], MeshBasicNodeMaterial>,
  }
}
describe('a work as an object apart from the world', () => {
  test.each(Object.entries(frames))('in the %s frame, it lies around its own middle, exactly as large as it tells, its image where its frame shows it', (id, frame) => {
    const {hold} = artwork()
    const model = new PortraitModel({
      ...work,
      frame: id as keyof typeof frames,
    }, hold)
    try {
      model.object.updateMatrixWorld(true)
      const {frame: moulding, image} = meshes(model)
      expect(moulding.material).toBe(frame.materials)
      const box = new Box3
      box.setFromObject(model.object, true)
      const extent = box.getSize(new Vector3)
      const middle = box.getCenter(new Vector3)
      // The box the studio frames and keeps its camera out of is the one the model really fills, around the origin: ornaments can stand out of the front and the reach a frame names for its moulding.
      expect(middle.length()).toBeLessThan(1e-6)
      expect(model.size.width).toBeCloseTo(extent.x, 6)
      expect(model.size.height).toBeCloseTo(extent.y, 6)
      expect(model.size.depth).toBeCloseTo(extent.z, 6)
      for (const corner of [box.min, box.max]) {
        expect(corner.length()).toBeLessThanOrEqual(subjectRadius(model.size) + 1e-6)
      }
      // A frame around the work: no smaller than the work, no larger than frames may get, and with some depth to it.
      expect(model.size.width).toBeGreaterThan(work.width)
      expect(model.size.height).toBeGreaterThan(work.height)
      expect(model.size.width).toBeLessThanOrEqual(work.width + maximumFrameReach * 2 + 1e-6)
      expect(model.size.height).toBeLessThanOrEqual(work.height + maximumFrameReach * 2 + 1e-6)
      expect(model.size.depth).toBeGreaterThan(0.01)
      // The image has the work’s size and lies in the frame like in the world.
      const imageBox = new Box3
      imageBox.setFromObject(image, true)
      const imageSize = imageBox.getSize(new Vector3)
      expect(imageSize.x).toBeCloseTo(work.width, 6)
      expect(imageSize.y).toBeCloseTo(work.height, 6)
      expect(imageSize.z).toBe(0)
      const offset = image.getWorldPosition(new Vector3).sub(moulding.getWorldPosition(new Vector3))
      expect(offset.x).toBe(0)
      expect(offset.y).toBe(0)
      expect(offset.z).toBeCloseTo(frame.imageDepth, 6)
    } finally {
      model.dispose()
    }
  })
  test('a work without a frame of its own wears the default one', () => {
    const {hold} = artwork()
    const model = new PortraitModel(work, hold)
    expect(meshes(model).frame.material).toBe(classicFrame.materials)
    model.dispose()
  })
  test('shows a placeholder until the artwork has loaded, then a texture of its own from the same image', async () => {
    const shared = new Texture({
      width: 4,
      height: 4,
    })
    shared.flipY = true
    const loading = Promise.withResolvers<Texture>()
    const {hold, release} = artwork(loading.promise)
    const model = new PortraitModel(work, hold)
    const {image} = meshes(model)
    expect(hold).toHaveBeenCalledWith(work.source)
    expect(image.material.map).toBeNull()
    expect(image.material.color.getHexString()).toBe(artworkPlaceholders.loading.slice(1))
    loading.resolve(shared)
    await model.loaded
    const own = image.material.map!
    expect(own).not.toBe(shared)
    // The same decoded image, laid out alike, uploaded for whoever draws the model.
    expect(own.source).toBe(shared.source)
    expect(own.flipY).toBe(true)
    expect(own.version).toBeGreaterThan(0)
    expect(image.material.color.getHexString()).toBe('ffffff')
    // Disposing the model frees its own texture and geometries, never what the world shares.
    const disposed = {
      own: mock(() => {}),
      shared: mock(() => {}),
      frameGeometry: mock(() => {}),
      frameMaterial: mock(() => {}),
    }
    own.addEventListener('dispose', disposed.own)
    shared.addEventListener('dispose', disposed.shared)
    const {frame: moulding} = meshes(model)
    moulding.geometry.addEventListener('dispose', disposed.frameGeometry)
    for (const material of classicFrame.materials) {
      material.addEventListener('dispose', disposed.frameMaterial)
    }
    try {
      model.dispose()
      model.dispose()
      expect(disposed.own).toHaveBeenCalledTimes(1)
      expect(disposed.frameGeometry).toHaveBeenCalledTimes(1)
      expect(disposed.shared).not.toHaveBeenCalled()
      expect(disposed.frameMaterial).not.toHaveBeenCalled()
      expect(release).toHaveBeenCalledTimes(1)
      expect(model.object.children).toHaveLength(0)
    } finally {
      for (const material of classicFrame.materials) {
        material.removeEventListener('dispose', disposed.frameMaterial)
      }
    }
  })
  test('an artwork that can’t be loaded shows as failed, and the model still counts as loaded', async () => {
    const failing = Promise.reject(new Error('gone'))
    const {hold} = artwork(failing)
    const model = new PortraitModel(work, hold)
    await model.loaded
    const {image} = meshes(model)
    expect(image.material.map).toBeNull()
    expect(image.material.color.getHexString()).toBe(artworkPlaceholders.failed.slice(1))
    model.dispose()
  })
  test('a model disposed while its artwork still loads never takes a texture', async () => {
    const loading = Promise.withResolvers<Texture>()
    const {hold, release} = artwork(loading.promise)
    const model = new PortraitModel(work, hold)
    const {image} = meshes(model)
    model.dispose()
    loading.resolve(new Texture)
    await model.loaded
    expect(image.material.map).toBeNull()
    expect(release).toHaveBeenCalledTimes(1)
  })
})
