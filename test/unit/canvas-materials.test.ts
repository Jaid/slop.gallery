import type {CanvasMaterialId} from '../../src/canvas_materials/index.ts'

import {afterAll, beforeAll, describe, expect, spyOn, test} from 'bun:test'

import {DataTexture, MeshPhysicalNodeMaterial, Texture} from 'three/webgpu'

import knifeRelief from '../../src/canvas_materials/impasto/knifeRelief.ts'
import layKnifeStrokes, {ground} from '../../src/canvas_materials/impasto/knifeStrokes.ts'
import {canvasMaterials} from '../../src/canvas_materials/index.ts'
import {canvasMaterialIds, isCanvasMaterialId} from '../../src/canvas_materials/lib/canvasMaterialIds.ts'
import {loadingItems} from '../../src/lib/loadingItems.ts'

const entries = Object.entries(canvasMaterials) as Array<[CanvasMaterialId, typeof canvasMaterials[CanvasMaterialId]]>
/** an image twice as wide as high, as the artworks’ textures hold them */
const image = Object.assign(new EventTarget, {
  width: 128,
  height: 64,
}) as unknown as HTMLCanvasElement
const artwork = () => new Texture(image)
/** A picture shrunk for the strokes to turn by: dark on the left, light on the right, so its contours run up and down. */
const guide = (width: number, height: number) => ({
  width,
  height,
  data: Uint8ClampedArray.from({length: width * height * 4}, (_, index) => (index % 4 === 3 ? 255 : Math.floor(index / 4 % width / width * 255))),
})
const previousDocument = globalThis.document
// The relief shrinks the image on a 2D canvas.
beforeAll(() => {
  globalThis.document = {
    createElement: () => ({
      width: 0,
      height: 0,
      getContext: () => ({
        drawImage() {},
        getImageData: (_x: number, _y: number, width: number, height: number) => guide(width, height),
      }),
    }),
  } as unknown as Document
})
afterAll(() => {
  globalThis.document = previousDocument
})
describe('canvas materials', () => {
  test('every id has a canvas material, named after its folder', () => {
    expect(Object.keys(canvasMaterials)).toEqual([...canvasMaterialIds])
    for (const [id, material] of entries) {
      expect(material.constructor.name.toLowerCase()).toBe(`${id.replaceAll('-', '')}canvasmaterial`)
      expect(material.title).toBeTruthy()
      expect(material.description).toBeTruthy()
      expect(material.strength).toBeGreaterThan(0)
      expect(material.strength).toBeLessThanOrEqual(1)
      expect(material.scale).toBeGreaterThan(0)
    }
    expect(isCanvasMaterialId('moire')).toBe(true)
    expect(isCanvasMaterialId('velvet')).toBe(false)
    expect(isCanvasMaterialId(undefined)).toBe(false)
  })
  test('each makes a material of its own for every image, which mixes its finish over the flat image', () => {
    for (const [, kind] of entries) {
      const map = artwork()
      const material = kind.createMaterial(map)
      expect(material).toBeInstanceOf(MeshPhysicalNodeMaterial)
      expect(material.outputNode).not.toBeNull()
      expect(kind.createMaterial(map)).not.toBe(material)
    }
  })
  test('the impasto’s strokes go along with its material', () => {
    const disposing = spyOn(DataTexture.prototype, 'dispose')
    try {
      const material = canvasMaterials.impasto.createMaterial(artwork())
      expect(disposing).not.toHaveBeenCalled()
      material.dispose()
      expect(disposing).toHaveBeenCalledTimes(1)
    } finally {
      disposing.mockRestore()
    }
  })
  test('the knife lays the same strokes on the same picture every time, all over it, and larger strokes otherwise', () => {
    const request = {
      guide: guide(160, 80),
      width: 1792,
      height: 896,
      size: 1,
    }
    const field = layKnifeStrokes(request)
    expect(field).toHaveLength(1792 * 896)
    expect(layKnifeStrokes(request)).toEqual(field)
    // The bare ground shows through only here and there.
    expect(field.filter(value => value === ground).length / field.length).toBeLessThan(0.1)
    expect(layKnifeStrokes({
      ...request,
      size: 2,
    })).not.toEqual(field)
  })
  test('a relief is flat bare ground at first and takes the strokes once the worker has laid them, at 896 rows for an ordinary print', async () => {
    const {relief, ready} = knifeRelief(artwork())
    const {data, width, height} = relief.image as {
      data: Uint8Array
      height: number
      width: number
    }
    expect([width, height]).toEqual([1792, 896])
    expect(data.every(value => value === ground)).toBe(true)
    // Something still loading, which captures wait for.
    expect(loadingItems().some(item => item.startsWith('knife-strokes:'))).toBe(true)
    const version = relief.version
    await ready
    expect(relief.version).toBeGreaterThan(version)
    expect(data).toEqual(layKnifeStrokes({
      guide: guide(160, 80),
      width,
      height,
      size: 1,
    }))
  })
  test.each([[4096, 1, 4096, 1], [1, 4096, 1, 896]])('a %i × %i strip gets a drawable, bounded relief', async (w, h, expectedWidth, expectedHeight) => {
    const {relief, ready} = knifeRelief(new Texture({
      width: w,
      height: h,
    } as HTMLCanvasElement))
    try {
      expect([relief.image.width, relief.image.height]).toEqual([expectedWidth, expectedHeight])
      const version = relief.version
      await ready
      expect(relief.version).toBeGreaterThan(version)
    } finally {
      relief.dispose()
    }
  })
})
