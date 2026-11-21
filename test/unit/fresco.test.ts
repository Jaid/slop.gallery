import {describe, expect, test} from 'bun:test'

import {wallFace, wallOpeningTrim} from '../../src/lib/gallery/architecture.ts'
import {frescoLayout, pompeianFresco} from '../../src/lib/gallery/fresco.ts'
import {salonWindow} from '../../src/lib/gallery/lobbyWindows.ts'
import FrescoWallMaterial from '../../src/lib/materials/FrescoWallMaterial.ts'
import walls from './fixtures/gallery.ts'

const wallById = (id: string) => walls.find(wall => wall.id === id)!
/** the positions sorted and rounded to micrometers, for comparing layouts */
const rounded = (list: ReadonlyArray<number>) => list.toSorted((a, b) => a - b).map(at => Math.round(at * 1e6) + 0)
describe('the Salon’s fresco', () => {
  test('lays its bands and panels out around each wall’s openings, a band flanking every doorway and window and every panel framed but the pierced ones', () => {
    const {band, openingMargin, panelLength, socle, frieze} = pompeianFresco
    expect(frieze[1]).toBeLessThan(5.5 - 0.47)
    expect(socle).toBeGreaterThan(0.44)
    // The window’s sill stands over the socle, and its head under the frieze.
    expect(salonWindow.bottom).toBeGreaterThan(socle)
    expect(salonWindow.top).toBeLessThan(frieze[0])
    for (const id of ['north', 'east', 'south', 'west']) {
      const wall = wallById(`salon-${id}`)
      const {bands, panels} = frescoLayout(wall)
      const end = wall.width / 2 - wallFace
      // Panels tile the wall face from corner to corner, a band between any two of them, each about a panel long unless an opening stands in it.
      expect(panels[0].u[0]).toBeCloseTo(-end, 9)
      expect(panels.at(-1)!.u[1]).toBeCloseTo(end, 9)
      for (const [index, panel] of panels.entries()) {
        if (index) {
          const gap = panel.u[0] - panels[index - 1].u[1]
          expect(gap).toBeCloseTo(band, 9)
          expect(bands.some(at => Math.abs(at - (panel.u[0] - band / 2)) < 1e-9)).toBe(true)
        }
        if (panel.pierced) {
          continue
        }
        expect(panel.u[1] - panel.u[0]).toBeGreaterThan(panelLength * 0.6)
        expect(panel.u[1] - panel.u[0]).toBeLessThan(panelLength * 1.5)
      }
      expect(bands).toHaveLength(panels.length - 1)
      // Bands are symmetric about the wall’s middle, and stand off the openings’ casings by the margin.
      expect(rounded(bands.map(at => -at))).toEqual(rounded(bands))
      for (const hole of wall.holes ?? []) {
        const pierced = panels.find(panel => panel.pierced && panel.u[0] < hole.u && hole.u < panel.u[1])!
        expect(pierced).toBeDefined()
        expect(pierced.u[0]).toBeCloseTo(hole.u - hole.width / 2 - wallOpeningTrim - openingMargin, 9)
        expect(pierced.u[1]).toBeCloseTo(hole.u + hole.width / 2 + wallOpeningTrim + openingMargin, 9)
      }
      expect(panels.filter(panel => panel.pierced)).toHaveLength(wall.holes?.length ?? 0)
    }
    // Three panels across the blank north wall, four down the blank east wall, one on either side of the arch and of the window.
    expect(frescoLayout(wallById('salon-north')).panels).toHaveLength(3)
    expect(frescoLayout(wallById('salon-north')).period).toBeUndefined()
    expect(frescoLayout(wallById('salon-east')).panels).toHaveLength(4)
    expect(frescoLayout(wallById('salon-south')).panels.map(panel => panel.pierced)).toEqual([false, true, false])
    expect(frescoLayout(wallById('salon-west')).panels.map(panel => panel.pierced)).toEqual([false, true, false])
    const material = new FrescoWallMaterial(frescoLayout(wallById('salon-south')))
    try {
      for (const node of [material.colorNode, material.roughnessNode, material.normalNode]) {
        expect(node?.isNode).toBe(true)
      }
    } finally {
      material.dispose()
    }
  })
})
describe('a round wall’s fresco', () => {
  // the Forge’s vestibule with two arches alike, as wide as the one into the room, without the window into the Bastion’s cistern
  const vestibule = wallById('forge-vestibule')
  const {width} = vestibule.holes!.find(hole => hole.name === 'forge')!
  const ring = {
    ...vestibule,
    holes: vestibule.holes!.filter(hole => hole.name !== 'cistern').map(hole => ({
      ...hole,
      width,
    })),
  }
  test('runs all round without a corner, its panels going on through the seam where its ends meet', () => {
    const {band, openingMargin, panelLength} = pompeianFresco
    const {bands, panels, period} = frescoLayout(ring)
    expect(period).toBeCloseTo(ring.width, 9)
    for (const at of [...bands, ...panels.map(panel => panel.u[0])]) {
      expect(Math.abs(at)).toBeLessThanOrEqual(period! / 2 + 1e-9)
    }
    // Round the ring, panels and bands take turns, as many of each.
    expect(bands).toHaveLength(panels.length)
    const wrap = (u: number) => u - period! * Math.floor(u / period!)
    const starts = panels.toSorted((a, b) => wrap(a.u[0]) - wrap(b.u[0]))
    for (const [index, panel] of starts.entries()) {
      const next = starts[(index + 1) % starts.length]
      const gap = wrap(next.u[0] - panel.u[1])
      expect(gap).toBeCloseTo(band, 9)
      expect(bands.some(at => Math.abs(wrap(at - panel.u[1] - band / 2 + period! / 2) - period! / 2) < 1e-9)).toBe(true)
    }
    // A bay round each arch; one narrow panel between both arches, and round the far side three of about a panel’s length.
    for (const hole of ring.holes) {
      const bay = panels.find(panel => panel.pierced && Math.abs(wrap((panel.u[0] + panel.u[1]) / 2 - hole.u + period! / 2) - period! / 2) < 1e-9)!
      expect(bay.u[1] - bay.u[0]).toBeCloseTo(hole.width + (wallOpeningTrim + openingMargin) * 2, 9)
    }
    const plain = panels.filter(panel => !panel.pierced).map(panel => panel.u[1] - panel.u[0]).toSorted((a, b) => a - b)
    expect(plain).toHaveLength(4)
    expect(plain[0]).toBeLessThan(panelLength / 2)
    for (const length of plain.slice(1)) {
      expect(length).toBeCloseTo(plain[1], 9)
      expect(length).toBeGreaterThan(panelLength * 0.6)
      expect(length).toBeLessThan(panelLength * 1.5)
    }
    const material = new FrescoWallMaterial({
      ...frescoLayout(ring),
      curveRadius: ring.curveRadius,
    })
    try {
      for (const node of [material.colorNode, material.roughnessNode, material.normalNode]) {
        expect(node?.isNode).toBe(true)
      }
    } finally {
      material.dispose()
    }
  })
})
