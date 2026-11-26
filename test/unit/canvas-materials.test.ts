import type {CanvasMaterialId} from '../../src/canvas_materials/index.ts'

import {afterAll, beforeAll, describe, expect, spyOn, test} from 'bun:test'

import {DataTexture, MeshPhysicalNodeMaterial, Texture} from 'three/webgpu'

import knifeRelief from '../../src/canvas_materials/impasto/knifeRelief.ts'
import layKnifeStrokes, {ground} from '../../src/canvas_materials/impasto/knifeStrokes.ts'
import {canvasMaterials} from '../../src/canvas_materials/index.ts'
import {canvasMaterialIds, isCanvasMaterialId} from '../../src/canvas_materials/lib/canvasMaterialIds.ts'
import {influenceBases} from '../../src/canvas_materials/lib/influence.ts'
import {loadingItems} from '../../src/lib/loadingItems.ts'

const entries = Object.entries(canvasMaterials) as Array<[CanvasMaterialId, typeof canvasMaterials[CanvasMaterialId]]>
/** an image twice as wide as high, as the artworks’ textures hold them */
const image = Object.assign(new EventTarget, {
  width: 128,
  height: 64,
}) as unknown as HTMLCanvasElement
const artwork = () => new Texture(image)
/** how large the image is on its work, in meters, as large as an ordinary print */
const size = {
  width: 2,
  height: 1,
}
/** A picture shrunk for the strokes to turn by: dark on the left, light on the right, so its contours run up and down. */
const guide = (width: number, height: number) => ({
  width,
  height,
  data: Uint8ClampedArray.from({length: width * height * 4}, (_, index) => (index % 4 === 3 ? 255 : Math.floor(index / 4 % width / width * 255))),
})
/** the texels of the relief the knife lays on a work of this size */
const texels = (width: number, height: number) => {
  const {relief} = knifeRelief(artwork(), {
    width,
    height,
  })
  relief.dispose()
  return [relief.image.width, relief.image.height]
}
/** whether a height is the bare ground’s, as closely as a half float holds it */
const bare = (value: number) => Math.abs(value - ground) < 0.001
/** the strokes on a 2 × 1 m work at this many texels per meter */
const strokesAt = (density: number) => layKnifeStrokes({
  guide: guide(140, 70),
  width: 2 * density,
  height: density,
  density,
  size: 1,
})
const materialsFolder = `${import.meta.dir}/../../src/canvas_materials/`
const scripts = new Bun.Glob('*.ts')
/** The code a canvas material shades with, without comments and strings: the files in its folder but its workers, and the foil base class if it is a foil. */
const shaderCode = async (id: CanvasMaterialId) => {
  const files = [...scripts.scanSync(`${materialsFolder}${id}`)].filter(file => !file.endsWith('.worker.ts'))
  const texts = await Promise.all(files.map(file => Bun.file(`${materialsFolder}${id}/${file}`).text()))
  if (texts.some(text => /extends FoilCanvasMaterial\b/.test(text))) {
    texts.push(await Bun.file(`${materialsFolder}base/FoilCanvasMaterial.ts`).text())
  }
  return texts.join('\n').replaceAll(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '').replaceAll(/'(?:[^\n'\\]|\\.)*'|`(?:[^\\`]|\\.)*`/g, "''")
}
/** what in a shader’s code shows it reads an influence: the view or the foil’s half vector, the pixel footprint in any form but the derivatives the normal helpers take, or the clock */
const influenceSignals = {
  angle: /\b(?:half|view)\b/,
  distance: /\bfine\(|\bfootprint\b|\.fwidth\(|\.dFd[xy]\(|\btextureSlope\(|\bthis\.ink\(/,
  time: /\b(?:deltaTime|frameId|time|timerDelta|timerGlobal|timerLocal)\b/,
}
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
  test('each lists what changes its look as its shader reads it, once each in the order of the bases, the light and the image always', async () => {
    for (const [id, material] of entries) {
      const bases = material.influences.map(({base}) => base)
      expect(bases).toEqual(influenceBases.filter(base => bases.includes(base)))
      expect(bases).toContain('light')
      expect(bases).toContain('texture')
      for (const {description} of material.influences) {
        expect(description === undefined || description.length > 0 && !/NaN|undefined/.test(description)).toBe(true)
      }
      const code = await shaderCode(id)
      for (const [base, signal] of Object.entries(influenceSignals)) {
        expect([id, base, bases.includes(base as keyof typeof influenceSignals)]).toEqual([id, base, signal.test(code)])
      }
    }
  })
  test('each makes a material of its own for every image, which mixes its finish over the flat image', () => {
    for (const [, kind] of entries) {
      const map = artwork()
      const material = kind.createMaterial(map, size)
      expect(material).toBeInstanceOf(MeshPhysicalNodeMaterial)
      expect(material.outputNode).not.toBeNull()
      expect(kind.createMaterial(map, size)).not.toBe(material)
    }
  })
  test('the impasto’s strokes go along with its material', () => {
    const disposing = spyOn(DataTexture.prototype, 'dispose')
    try {
      const material = canvasMaterials.impasto.createMaterial(artwork(), size)
      expect(disposing).not.toHaveBeenCalled()
      material.dispose()
      expect(disposing).toHaveBeenCalledTimes(1)
    } finally {
      disposing.mockRestore()
    }
  })
  test('the knife lays the same strokes on the same picture every time, all over it, and larger strokes otherwise', () => {
    const request = {
      guide: guide(140, 70),
      width: 1600,
      height: 800,
      density: 800,
      size: 1,
    }
    const field = layKnifeStrokes(request)
    expect(field).toHaveLength(1600 * 800)
    expect(layKnifeStrokes(request)).toEqual(field)
    // The bare ground shows through only here and there.
    const bareShare = field.filter(value => bare(value)).length / field.length
    expect(bareShare).toBeGreaterThan(0)
    expect(bareShare).toBeLessThan(0.1)
    expect(layKnifeStrokes({
      ...request,
      size: 2,
    })).not.toEqual(field)
  })
  test('a relief is flat bare ground at first and takes the strokes once the workers have laid them, at 1600 texels per meter for an ordinary print', async () => {
    const {relief, ready} = knifeRelief(artwork(), size)
    const {data, width, height} = relief.image as {
      data: Uint16Array
      height: number
      width: number
    }
    // The texture holds half floats by their bits.
    const heights = new Float16Array(data.buffer)
    expect([width, height]).toEqual([3200, 1600])
    expect(heights.every(value => bare(value))).toBe(true)
    // Something still loading, which captures wait for.
    expect(loadingItems().some(item => item.startsWith('knife-strokes:'))).toBe(true)
    const version = relief.version
    await ready
    expect(relief.version).toBeGreaterThan(version)
    expect(heights).toEqual(layKnifeStrokes({
      guide: guide(140, 70),
      width,
      height,
      density: 1600,
      size: 1,
    }))
  })
  test.each([[4096, 1, 78, 0.019, 4096, 1], [1, 4096, 0.019, 78, 1, 4096]])('a %i × %i strip %f × %f m large gets a drawable, bounded relief', async (w, h, meterWidth, meterHeight, expectedWidth, expectedHeight) => {
    const {relief, ready} = knifeRelief(new Texture({
      width: w,
      height: h,
    } as HTMLCanvasElement), {
      width: meterWidth,
      height: meterHeight,
    })
    try {
      expect([relief.image.width, relief.image.height]).toEqual([expectedWidth, expectedHeight])
      const version = relief.version
      await ready
      expect(relief.version).toBeGreaterThan(version)
    } finally {
      relief.dispose()
    }
  })
  test('a larger work gets a relief of more texels at the same density, and fewer per meter past 3.3 m², so the workers stay quick', () => {
    expect(texels(1, 0.5)).toEqual([1600, 800])
    expect(texels(2.4, 1.2)).toEqual([3840, 1920])
    const [width, height] = texels(4, 2)
    expect(width / height).toBeCloseTo(2, 2)
    expect(width * height).toBeLessThanOrEqual(2 ** 23)
  })
  test('the strokes are as large in meters whatever the relief’s density', () => {
    const fine = strokesAt(800)
    const coarse = strokesAt(400)
    // Shrunk to the coarse relief’s texels, the fine relief shows the same paint.
    let difference = 0
    for (let row = 0; row < 400; row++) {
      for (let column = 0; column < 800; column++) {
        const at = (x: number, y: number) => fine[(2 * row + y) * 1600 + 2 * column + x]
        difference += Math.abs((at(0, 0) + at(1, 0) + at(0, 1) + at(1, 1)) / 4 - coarse[row * 800 + column])
      }
    }
    // Strokes twice or half as large differ by about 0.065.
    expect(difference / coarse.length).toBeLessThan(0.035)
  })
  test('workers laying a relief band by band lay the same strokes as one laying it whole', () => {
    const request = {
      guide: guide(140, 70),
      width: 1600,
      height: 800,
      density: 800,
      size: 1,
    }
    const whole = layKnifeStrokes(request)
    const bands = [[0, 213], [213, 600], [600, 800]].map(rows => layKnifeStrokes({
      ...request,
      rows: rows as [number, number],
    }))
    expect(bands.map(band => band.length)).toEqual([213 * 1600, 387 * 1600, 200 * 1600])
    const joined = new Float16Array(whole.length)
    joined.set(bands[0])
    joined.set(bands[1], 213 * 1600)
    joined.set(bands[2], 600 * 1600)
    expect(joined).toEqual(whole)
  })
})
