import {expect, test} from 'bun:test'
import {fileURLToPath} from 'node:url'

import {knotBays, knotNumberLabel} from 'knot-materials/exhibition.ts'
import {knotPreviewBottomClearance, knotPreviewHeight, knotPreviewMountY, knotPreviewPanelOffsetY, knotPreviewTextureHeight, knotPreviewTextureLayout, knotPreviewTextureWidth, knotPreviewWidth} from 'knot-materials/KnotPreviewLayout.ts'
import {billboardParts} from 'knot-materials/signs.ts'
import puppeteer from 'puppeteer-core'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import {preprocessCSS, resolveConfig} from 'vite'

import KnotPreviewFace, {knotPreviewBackground} from '#component/KnotPreviewFace'

import signAccentColor from '../../src/components/signAccentColor.ts'

test('runtime billboards keep one 3:2 mesh and pack stickers to fit the fixed raster', () => {
  expect(knotPreviewWidth / knotPreviewHeight).toBeCloseTo(3 / 2)
  expect(knotPreviewTextureWidth / knotPreviewTextureHeight).toBeCloseTo(3 / 2)
  const parts = billboardParts(knotPreviewWidth, knotPreviewHeight, knotPreviewPanelOffsetY)
  expect(knotPreviewMountY + parts[0].position[1] - parts[0].size[1] / 2).toBeCloseTo(knotPreviewBottomClearance)
  expect(Math.min(...parts.filter(part => !part.rotation).map(part => knotPreviewMountY + part.position[1] - part.size[1] / 2))).toBeCloseTo(0)
  for (let count = 0; count <= 36; count++) {
    const {rows, rowCounts, width, height, tileWidth, rowHeight} = knotPreviewTextureLayout(count)
    expect([width, height]).toEqual([knotPreviewTextureWidth, knotPreviewTextureHeight])
    expect(tileWidth).toBeGreaterThan(0)
    expect(rowHeight).toBeGreaterThan(0)
    expect(rowCounts).toHaveLength(rows)
    expect(rows * rowHeight).toBeLessThanOrEqual(height + 1e-9)
    expect(rowCounts.reduce((sum, length) => sum + length, 0)).toBe(count)
    for (const [row, length] of rowCounts.entries()) {
      expect(Number.isSafeInteger(length)).toBe(true)
      expect(length).toBeGreaterThanOrEqual(count ? 1 : 0)
      expect(length * tileWidth).toBeLessThanOrEqual(width + 1e-9)
      // Moving in from either edge, shorter rows belong toward the middle.
      const opposite = rows - 1 - row
      if (!(row + 1 < opposite)) {
        continue
      }
      expect(rowCounts[row + 1]).toBeLessThanOrEqual(length)
      expect(rowCounts[opposite - 1]).toBeLessThanOrEqual(rowCounts[opposite])
    }
  }
})
test.skipIf(!Bun.env.BROWSER)('the billboard centers the tiles in each row and shows each finish exactly once', async () => {
  const count = 11
  const finishes = Array.from({length: count}, (_, i) => ({
    ...knotBays[0].finishes[0],
    id: String(i),
    number: i + 1,
    title: `Finish ${i}`,
  }))
  const markup = renderToStaticMarkup(createElement(KnotPreviewFace, {
    bay: {finishes},
    images: new Map,
  }))
  const file = fileURLToPath(new URL('../../src/components/KnotPreviewFace/style.module.sass', import.meta.url))
  const config = await resolveConfig({
    configLoader: 'native',
    logLevel: 'silent',
  }, 'serve')
  const {code} = await preprocessCSS(await Bun.file(file).text(), file, config)
  await using browser = await puppeteer.launch({executablePath: Bun.env.BROWSER})
  const page = await browser.newPage()
  await page.setContent(`<style>${code}</style>${markup}`)
  const rows = await page.$$eval('body > div > div', elements => elements.map(row => {
    const tiles = [...row.children]
    const bounds = row.getBoundingClientRect()
    return {
      left: tiles[0].getBoundingClientRect().left - bounds.left,
      right: bounds.right - tiles.at(-1)!.getBoundingClientRect().right,
      captions: tiles.map(tile => tile.textContent),
    }
  }))
  expect(rows.flatMap(row => row.captions)).toEqual(finishes.map(finish => `${knotNumberLabel(finish.number)} · ${finish.title}`))
  for (const {left, right} of rows) {
    expect(left).toBeGreaterThanOrEqual(-0.5)
    expect(Math.abs(left - right)).toBeLessThan(0.5)
  }
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
    expect(markup).toContain(`style="color:${signAccentColor(finish.placeholder.color)}">${knotNumberLabel(finish.number)} · ${finish.title}<`)
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
