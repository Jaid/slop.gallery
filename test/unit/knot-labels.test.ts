import {describe, expect, test} from 'bun:test'

import {knotsById} from 'knot-materials'
import {knotBays, knotExhibition} from 'knot-materials/exhibition.ts'
import {knotSign} from 'knot-materials/signs.ts'
import {createElement} from 'react'
import {renderToStaticMarkup} from 'react-dom/server'

import KnotLabelFace, {KnotLabelFaces} from '#component/KnotLabelFace'

import {knotDetailLine, labelAtlasColumns, labelBackground, labelHeight, labelTile, labelWidth} from '../../src/components/KnotLabels/layout.ts'
import redrawPlates from '../../src/components/KnotLabels/redrawPlates.ts'
import signAccentColor from '../../src/components/signAccentColor.ts'

const iconHash = async (id: string) => Bun.hash(await Bun.file(new URL(knotsById.get(id)!.candidate.icon)).arrayBuffer())
describe('Knot nameplates', () => {
  test('a complete face preserves text density and the atlas fits the current exhibition', () => {
    expect([labelWidth, labelHeight]).toEqual([720, 480])
    expect(labelWidth / labelHeight).toBeCloseTo(knotSign.width / knotSign.height)
    expect(labelWidth / knotSign.width).toBeGreaterThanOrEqual(800)
    expect(labelHeight / knotSign.height).toBeGreaterThanOrEqual(800)
    expect(labelAtlasColumns * labelWidth).toBeLessThanOrEqual(8192)
    expect(Math.ceil(knotExhibition.length / labelAtlasColumns) * labelHeight).toBeLessThanOrEqual(8192)
  })
  test('ships a local SVG candidate mark for every exhibited model and reuses family marks', async () => {
    const urls = new Set<string>
    for (const bay of knotBays) {
      const url = bay.candidate.icon
      expect(url).toBeDefined()
      const iconUrl = new URL(url)
      expect(iconUrl.pathname.endsWith('/symbol.svg')).toBe(true)
      expect(await Bun.file(new URL(url)).text()).toContain('<svg')
      urls.add(Bun.hash(await Bun.file(new URL(url)).arrayBuffer()).toString())
    }
    expect(urls.size).toBeGreaterThan(0)
    expect(urls.size).toBeLessThan(knotBays.length)
    expect(await iconHash('lenticular_mirage')).toBe(await iconHash('solar_reliquary'))
    expect(await iconHash('solar_reliquary')).toBe(await iconHash('coralline_crown'))
    expect(await iconHash('celestial_rose')).toBe(await iconHash('lenticular_mirage'))
    expect(await iconHash('opal_fire')).toBe(await iconHash('lightless_border'))
    expect(await iconHash('cyber_kintsugi')).toBe(await iconHash('schwarzschild_vault'))
  })
  test('a face holds its number, title, stars, model with its mark and how it was made, with every line of text fitted', () => {
    const exhibit = knotExhibition[0]
    const markup = renderToStaticMarkup(createElement(KnotLabelFace, {exhibit}))
    expect(markup).toContain(`width:${labelWidth}px;height:${labelHeight}px`)
    expect(markup).toContain(`background:${labelBackground}`)
    expect(markup).toContain(`style="background:${signAccentColor(exhibit.placeholder.color)}"`)
    expect(markup).toContain(`style="color:${signAccentColor(exhibit.placeholder.color)}" data-fit="">${exhibit.title}<`)
    for (const text of [exhibit.label, exhibit.title, exhibit.modelTitle, knotDetailLine(exhibit.harness, exhibit.author.model.effortLevel), Array.from({length: exhibit.rarity}, () => '★').join(' ')]) {
      expect(markup.split(`>${text}<`)).toHaveLength(2)
    }
    expect(markup.split('<img')).toHaveLength(2)
    expect(markup).toContain(`src="${exhibit.candidate.icon}"`)
    expect(markup.split('data-fit')).toHaveLength(5)
    // The model’s mark comes before its name, in one line.
    expect(markup.indexOf('<img')).toBeLessThan(markup.indexOf(`>${exhibit.modelTitle}<`))
  })
  test('a face without a mark or a way it was made leaves both out instead of leaving them empty', () => {
    const markup = renderToStaticMarkup(createElement(KnotLabelFace, {
      exhibit: {
        ...knotExhibition[0],
        candidate: undefined,
        harness: undefined,
        author: {model: {title: knotExhibition[0].modelTitle}},
      },
    }))
    expect(markup).not.toContain('<img')
    expect(markup.split('data-fit')).toHaveLength(4)
  })
  test('formats harness and thinking effort with flattenString.list semantics', () => {
    const cases = [
      [undefined, undefined, ''],
      ['', '', ''],
      ['none', undefined, 'non-agentic'],
      ['none', 'high', 'non-agentic, high effort'],
      ['Codex', undefined, 'Codex'],
      [undefined, 'high', 'high effort'],
      ['Codex', 'high', 'Codex, high effort'],
    ] as const
    for (const [harness, effortLevel, expected] of cases) {
      expect(knotDetailLine(harness, effortLevel)).toBe(expected)
      const markup = renderToStaticMarkup(createElement(KnotLabelFace, {
        exhibit: {
          ...knotExhibition[0],
          harness,
          author: {
            model: {
              title: knotExhibition[0].modelTitle,
              effortLevel,
            },
          },
        },
      }))
      // An empty one leaves its line out.
      expect(markup.split('data-fit')).toHaveLength(expected ? 5 : 4)
      if (expected) {
        expect(markup).toContain(`>${expected}<`)
      }
    }
  })
  test('the atlas lays every face out row by row, where the instanced batch looks for it', () => {
    const exhibits = knotExhibition.slice(0, labelAtlasColumns + 2)
    const markup = renderToStaticMarkup(createElement(KnotLabelFaces, {exhibits}))
    expect(markup).toContain(`grid-template-columns:repeat(${labelAtlasColumns}, ${labelWidth}px)`)
    expect(markup).toContain(`width:${labelAtlasColumns * labelWidth}px`)
    const positions = exhibits.map(exhibit => markup.indexOf(`>${exhibit.title}<`))
    expect(positions.every(position => position > 0)).toBe(true)
    expect(positions).toEqual(positions.toSorted((a, b) => a - b))
    expect(labelTile(0)).toEqual({
      x: 0,
      y: 0,
    })
    expect(labelTile(labelAtlasColumns - 1)).toEqual({
      x: (labelAtlasColumns - 1) * labelWidth,
      y: 0,
    })
    expect(labelTile(labelAtlasColumns + 1)).toEqual({
      x: labelWidth,
      y: labelHeight,
    })
  })
})
test('one through five stars are shown, and none for an unknown rarity while the rest of the face stays', () => {
  for (const rarity of [1, 2, 3, 4, 5] as const) {
    const markup = renderToStaticMarkup(createElement(KnotLabelFace, {
      exhibit: {
        ...knotExhibition[0],
        rarity,
      },
    }))
    expect(markup).toContain(`>${Array.from({length: rarity}, () => '★').join(' ')}<`)
  }
  const exhibit = {
    ...knotExhibition[0],
    rarity: 0 as const,
  }
  const markup = renderToStaticMarkup(createElement(KnotLabelFace, {exhibit}))
  expect(markup).toContain(`>${exhibit.title}<`)
  expect(markup).toContain(`>${exhibit.modelTitle}<`)
  expect(markup).not.toContain('★')
})
test('a live rarity edit redraws only the changed face over its tile and marks the existing atlas for upload', async () => {
  const exhibits = knotExhibition.slice(0, labelAtlasColumns + 3)
  const changed = exhibits[labelAtlasColumns + 1]
  const draws: Array<Array<unknown>> = []
  const atlas = {
    image: {getContext: () => ({drawImage: (...args: Array<unknown>) => draws.push(args)})},
    needsUpdate: false,
  }
  const shows = new Map(exhibits.map(exhibit => [exhibit.id, exhibit.rarity]))
  const rasterized: Array<{
    id: string
    rarity: number
  }> = []
  const plates: Array<{width: number}> = []
  const rasterize = async (exhibit: {
    id: string
    rarity: number
  }) => {
    rasterized.push({
      id: exhibit.id,
      rarity: exhibit.rarity,
    })
    const plate = {width: labelWidth}
    plates.push(plate)
    return plate as HTMLCanvasElement
  }
  type Arguments = Parameters<typeof redrawPlates>
  await redrawPlates(atlas as unknown as Arguments[0], exhibits, new Map, shows, rasterize)
  expect(draws).toEqual([])
  expect(atlas.needsUpdate).toBe(false)
  await redrawPlates(atlas as unknown as Arguments[0], exhibits, new Map([[changed.id, 0]]), shows, rasterize)
  expect(rasterized).toEqual([
    {
      id: changed.id,
      rarity: 0,
    },
  ])
  expect(draws).toEqual([[plates[0], labelWidth, labelHeight, labelWidth, labelHeight]])
  // The face’s own canvas is released once it lies in the atlas.
  expect(plates[0].width).toBe(0)
  expect(shows.get(changed.id)).toBe(0)
  expect(atlas.needsUpdate).toBe(true)
  await redrawPlates(atlas as unknown as Arguments[0], exhibits, new Map([[changed.id, 0]]), shows, rasterize)
  expect(rasterized).toHaveLength(1)
})
