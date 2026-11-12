import {expect, test} from 'bun:test'

import {knotBays, knotNumberLabel} from 'knot-materials/exhibition.ts'
import {knotPreviewBottomClearance, knotPreviewHeight, knotPreviewMountY, knotPreviewPanelOffsetY, knotPreviewTextureHeight, knotPreviewTextureLayout, knotPreviewTextureWidth, knotPreviewWidth} from 'knot-materials/KnotPreviewLayout.ts'
import {billboardParts} from 'knot-materials/signs.ts'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

import KnotPreviewFace, {knotPreviewBackground} from '#component/KnotPreviewFace'

import signAccentColor from '../../src/components/signAccentColor.ts'

test('runtime billboards keep one 3:2 mesh and pack stickers to fit the fixed raster', () => {
  expect(knotPreviewWidth / knotPreviewHeight).toBeCloseTo(3 / 2)
  expect(knotPreviewTextureWidth / knotPreviewTextureHeight).toBeCloseTo(3 / 2)
  const parts = billboardParts(knotPreviewWidth, knotPreviewHeight, knotPreviewPanelOffsetY)
  expect(knotPreviewMountY + parts[0].position[1] - parts[0].size[1] / 2).toBeCloseTo(knotPreviewBottomClearance)
  expect(Math.min(...parts.filter(part => !part.rotation).map(part => knotPreviewMountY + part.position[1] - part.size[1] / 2))).toBeCloseTo(0)
  const formats = new Map<number, [number, number]>([
    [1, [1, 1]],
    [2, [2, 1]],
    [3, [3, 1]],
    [4, [2, 2]],
    [5, [3, 2]],
    [6, [3, 2]],
    [7, [4, 2]],
    [8, [4, 2]],
    [9, [5, 2]],
    [10, [5, 2]],
    [11, [4, 3]],
    [16, [6, 3]],
    [22, [6, 4]],
    [36, [8, 5]],
  ])
  for (const [count, [columns, rows]] of formats) {
    const layout = knotPreviewTextureLayout(count)
    expect([layout.columns, layout.rows]).toEqual([columns, rows])
    expect(layout.width).toBe(knotPreviewTextureWidth)
    expect(layout.height).toBe(knotPreviewTextureHeight)
    expect(layout.rowCounts.reduce((sum, rowCount) => sum + rowCount, 0)).toBe(count)
    expect(Math.max(...layout.rowCounts)).toBe(columns)
  }
})
test('shorter rows are kept in the middle and centered within the billboard', () => {
  expect(knotPreviewTextureLayout(11).rowCounts).toEqual([4, 3, 4])
  expect(knotPreviewTextureLayout(13).rowCounts).toEqual([5, 3, 5])
  expect(knotPreviewTextureLayout(36).rowCounts).toEqual([8, 7, 6, 7, 8])
  const source = knotBays.find(bay => bay.finishes.length === 4)!
  const bay = {
    ...source,
    finishes: [...source.finishes, {
      ...source.finishes[0],
      number: source.finishes.at(-1)!.number + 1,
    }],
  }
  const layout = knotPreviewTextureLayout(bay.finishes.length)
  expect(layout.rowCounts).toEqual([2, 3])
  const markup = renderToStaticMarkup(createElement(KnotPreviewFace, {
    bay,
    images: new Map,
  }))
  const rows = markup.split(`height:${layout.rowHeight}px`).slice(1)
  expect(rows.map(row => row.split('data-fit').length - 1)).toEqual([2, 3])
  expect(markup.split(`width:${layout.tileWidth}px`)).toHaveLength(6)
})
test('runtime billboard textures keep the default preview population below 192 MiB', () => {
  const bytes = knotBays.reduce((total, bay) => {
    const raster = knotPreviewTextureLayout(bay.finishes.length)
    return total + raster.width * raster.height * 4
  }, 0)
  expect(bytes).toBeLessThan(192 * 1024 ** 2)
  expect(knotBays.every(bay => bay.finishes.length > 0)).toBe(true)
})
test('a billboard shows dynamic numbers, titles, accents, pictures in their own proportions and plain squares for missing ones in one face', () => {
  const bay = knotBays[0]
  const layout = knotPreviewTextureLayout(bay.finishes.length)
  const picture = {
    width: 200,
    height: 100,
  } as HTMLCanvasElement
  const markup = renderToStaticMarkup(createElement(KnotPreviewFace, {
    bay,
    images: new Map([[bay.finishes[0].id, picture]]),
  }))
  expect(markup).toContain(`width:${layout.width}px;height:${layout.height}px;background:${knotPreviewBackground}`)
  for (const finish of bay.finishes) {
    expect(markup).toContain(`style="color:${signAccentColor(finish.placeholder.color)}" data-fit="">${knotNumberLabel(finish.number)} · ${finish.title}<`)
  }
  const pictures = markup.matchAll(/class="([^"]*)" style="width:([\d.]+)px;height:([\d.]+)px"/gu).filter(match => match[2] !== String(layout.tileWidth)).toArray()
  expect(pictures).toHaveLength(bay.finishes.length)
  // The first finish has a picture twice as wide as high, the others fall back to squares of another class.
  expect(Number(pictures[0][2])).toBeCloseTo(Number(pictures[0][3]) * 2)
  for (const fallback of pictures.slice(1)) {
    expect(fallback[2]).toBe(fallback[3])
    expect(fallback[1]).not.toBe(pictures[0][1])
    expect(Number(fallback[2])).toBeCloseTo(Number(pictures[0][2]))
  }
})
