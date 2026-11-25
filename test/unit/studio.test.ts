import type {TuningColor} from '../../src/lib/worldTuning/controls.ts'
import type {Spread} from '../../src/rooms/studio/openings/base/OpeningStyle.ts'
import type {StudioOpenings} from '../../src/rooms/studio/openings/index.ts'
import type {LayoutOptions} from '../../src/rooms/studio/openings/lib/layouts.ts'
import type {StudioPlan} from '../../src/rooms/studio/plan.ts'
import type {Vec3} from 'math'

import {expect, test} from 'bun:test'

import StableRandom from 'stable-random'
import {Vector3} from 'three/webgpu'

import StudioTuningModule from '../../src/lib/worldTuning/StudioTuningModule.ts'
import WorldTuning from '../../src/lib/worldTuning/WorldTuning.ts'
import ceilingGeometry from '../../src/rooms/studio/ceilingGeometry.ts'
import {designLook, designPlan, ownMirrorBlur, studioDesign} from '../../src/rooms/studio/design.ts'
import {studioFloorId, studioFloors, studioWallId, studioWalls} from '../../src/rooms/studio/finishes.ts'
import {defaultStudioLook, kelvinTint, moonDirectionOf, studioFrames, studioLook, studioLookRanges, studioMirrorlessChance, studioShaftlessChance} from '../../src/rooms/studio/look.ts'
import {openingStyles, studioOpenings, studioOpeningStyle} from '../../src/rooms/studio/openings/index.ts'
import {voronoiCells} from '../../src/rooms/studio/openings/lib/cells.ts'
import {field, flanked, grid, medallion, row, staggered} from '../../src/rooms/studio/openings/lib/layouts.ts'
import {outline, outlineKinds} from '../../src/rooms/studio/openings/lib/outlines.ts'
import {area, contains, inset, intersect, narrowerThan, point, reach, translate, unite} from '../../src/rooms/studio/openings/lib/polygons.ts'
import {openingStyleIds, readOpenings} from '../../src/rooms/studio/openings/openingParameter.ts'
import {ceilingShift, defaultStudioPlan, openingSpread, studioPlan, studioPlanRanges, studioRim, studioSlab} from '../../src/rooms/studio/plan.ts'
import {rollOnStep} from '../../src/rooms/studio/steps.ts'
import {moonlight} from '../../src/worlds/sandbox/moon.ts'
import StudioSandbox from '../../src/worlds/sandbox/StudioSandbox.ts'

const studio = new StudioSandbox(0)
const within = (value: number, [min, max]: readonly [number, number]) => value >= min && value <= max
const room = studio.room('studio')
const channels = (kelvin: number) => Bun.color(kelvinTint(kelvin), '[rgb]')!
/** the values to a billionth, past which rounding errors of adding up meters lie */
const rounded = (values: ReadonlyArray<number>) => values.map(value => Math.round(value * 1e9) / 1e9)
/** seeds every opening test goes through, the default one first */
const seeds = Array.from({length: 61}, (_, index) => index)
/** the openings of every seed in `seeds`, and of a few seeds for every kind forced */
const rolled: ReadonlyArray<readonly [label: string, openings: StudioOpenings, toLight: Vec3, plan: StudioPlan]> = [
  ...seeds.map(seed => {
    const toLight = moonDirectionOf(studioLook(seed))
    return [`seed ${seed}`, studioOpenings(seed, toLight, ''), toLight, studioPlan(seed)] as const
  }),
  ...openingStyleIds.flatMap(style => [101, 102, 103].map(seed => {
    const toLight = moonDirectionOf(studioLook(seed))
    return [`${style} on seed ${seed}`, studioOpenings(seed, toLight, style), toLight, studioPlan(seed)] as const
  })),
]
test('the Studio is 8 × 8 m under a ceiling 8 m up in the default environment, and otherwise rolls its width, depth and height within their ranges to whole meters', () => {
  expect(studioPlan(0)).toBe(defaultStudioPlan)
  expect(defaultStudioPlan).toEqual({
    clear: [8, 8],
    height: 8,
  })
  const widths = new Set<number>
  for (let seed = 1; seed <= 200; seed++) {
    const {clear: [width, depth], height} = studioPlan(seed)
    for (const [value, range] of [[width, studioPlanRanges.width], [depth, studioPlanRanges.depth], [height, studioPlanRanges.height]] as const) {
      expect(within(value, range)).toBe(true)
      expect(Number.isInteger(value)).toBe(true)
    }
    widths.add(Math.floor(width))
  }
  // Every whole meter of the range turns up.
  expect(widths.size).toBeGreaterThanOrEqual(studioPlanRanges.width[1] - studioPlanRanges.width[0])
  expect(studioPlan(5)).toEqual(studioPlan(5))
})
test('the Studio uses its default look for seed zero and otherwise rolls a frame and lights within their ranges, its lamps hung within its room, the secondary one on some seeds only, sometimes a warm sun, mostly shining faintly, and sometimes no shafts at all', () => {
  expect(studioLook(0)).toBe(defaultStudioLook)
  expect(studioLook(5)).toEqual(studioLook(5))
  expect(studioLook(5)).not.toEqual(studioLook(6))
  const frames = new Set<string>
  let [suns, sharp, seconds, shaftless, mirrorless] = [0, 0, 0, 0, 0]
  /** where in its range each moon or sun shines, from 0 for the faintest to 1 for the brightest */
  const shines: Array<number> = []
  for (let seed = 1; seed <= 200; seed++) {
    const {fill, floor, frame, lamps: {primary: lamp, secondary}, moon} = studioLook(seed)
    const {clear: [width, depth], height} = studioPlan(seed)
    frames.add(frame)
    expect(within(fill.ambient, studioLookRanges.ambient)).toBe(true)
    expect(within(fill.hemisphere, studioLookRanges.hemisphere)).toBe(true)
    mirrorless += Number(floor.strength === 0)
    expect(floor.strength === 0 || within(floor.strength, studioLookRanges.floorStrength)).toBe(true)
    expect(within(floor.blur!, studioLookRanges.floorBlur)).toBe(true)
    expect(Number.isInteger(floor.blur)).toBe(true)
    expect(floor.loss).toBe(1)
    expect(within(lamp.blur, studioLookRanges.lampBlur)).toBe(true)
    expect(within(lamp.decay, studioLookRanges.lampDecay)).toBe(true)
    expect(within(lamp.strength, studioLookRanges.lampStrength)).toBe(true)
    // Off the middle by a fifth of the room at most either way, and 1.5 m under the ceiling at least.
    const [x, y, z] = lamp.position
    expect(Math.abs(x)).toBeLessThanOrEqual(width * 0.2 + 0.005)
    expect(Math.abs(z)).toBeLessThanOrEqual(depth * 0.2 + 0.005)
    expect(y).toBeGreaterThanOrEqual(studioLookRanges.lampHeight[0])
    expect(y).toBeLessThanOrEqual(Math.min(studioLookRanges.lampHeight[1], height - 1.5) + 0.05)
    expect(lamp.tint).toMatch(/^#[\da-f]{6}$/u)
    // Anywhere but near the walls, and between 30% and 70% of the way up, which leaves 1.5 m under the ceiling at least.
    const [secondX, secondY, secondZ] = secondary.position
    const share = (meters: number, span: number) => Math.round((meters / span + 0.5) * 1e9) / 1e9
    expect(within(share(secondX, width), studioLookRanges.secondaryLampShare)).toBe(true)
    expect(within(share(secondZ, depth), studioLookRanges.secondaryLampShare)).toBe(true)
    expect(within(Math.round(secondY / height * 1e9) / 1e9, studioLookRanges.secondaryLampHeight)).toBe(true)
    expect(secondY).toBeLessThanOrEqual(height - 1.5)
    expect([lamp.range, secondary.range]).toEqual([25, 25])
    expect(within(secondary.decay, studioLookRanges.lampDecay)).toBe(true)
    if (secondary.strength > 0) {
      seconds++
      expect(within(secondary.strength, studioLookRanges.secondaryLampStrength)).toBe(true)
    }
    expect(within(moon.azimuth, studioLookRanges.moonAzimuth)).toBe(true)
    expect(within(moon.blur, studioLookRanges.moonBlur)).toBe(true)
    expect(within(moon.elevation, studioLookRanges.moonElevation)).toBe(true)
    expect(moon.color).toMatch(/^#[\da-f]{6}$/u)
    if (moon.color !== moonlight.color) {
      suns++
      // Warm: more red than blue.
      const [red, , blue] = Bun.color(moon.color, '[rgb]')!
      expect(red).toBeGreaterThan(blue)
    }
    if (moon.shafts === 0) {
      shaftless++
    }
    expect(moon.shafts === 0 || within(moon.shafts, studioLookRanges.moonShafts)).toBe(true)
    const [faintest, brightest] = moon.color === moonlight.color ? studioLookRanges.moonIntensity : studioLookRanges.sunIntensity
    expect(within(moon.intensity, [faintest, brightest])).toBe(true)
    shines.push((moon.intensity - faintest) / (brightest - faintest))
    sharp += Number(lamp.blur < 1)
  }
  expect(frames).toEqual(new Set(studioFrames))
  expect(suns).toBeGreaterThan(40)
  expect(suns).toBeLessThan(110)
  expect(sharp).toBeGreaterThan(10)
  expect(seconds).toBeGreaterThan(35)
  expect(seconds).toBeLessThan(90)
  // No mirror on about one seed in ten, and clear air on about one in ten.
  expect(mirrorless).toBeGreaterThan(200 * studioMirrorlessChance / 2)
  expect(mirrorless).toBeLessThan(200 * studioMirrorlessChance * 2)
  expect(shaftless).toBeGreaterThan(200 * studioShaftlessChance / 2)
  expect(shaftless).toBeLessThan(200 * studioShaftlessChance * 2)
  // Mostly faint: half within the faintest eighth of the range and four in five in its fainter half, yet some bright ones.
  const share = (below: number) => shines.filter(shine => shine < below).length / shines.length
  expect(share(0.13)).toBeGreaterThan(0.38)
  expect(share(0.5)).toBeGreaterThan(0.68)
  expect(share(1.01) - share(0.5)).toBeGreaterThan(0.05)
})
test('every work in the Studio hangs in the one frame the seed rolled, the default works and those hung later alike', () => {
  for (const seed of [0, 3, 17, 42]) {
    const sandbox = seed ? new StudioSandbox(seed) : studio
    const placed = sandbox.room('studio')
    const {frame} = studioLook(seed)
    expect(placed.room.frame).toBe(frame)
    for (const work of ['north', 'some-hung-work', 'another']) {
      expect(placed.frame(seed, work)).toBe(frame)
    }
  }
})
test('a lamp’s color temperature runs from candlelight orange to a cool white', () => {
  const [red, green, blue] = channels(2200)
  expect(red).toBeGreaterThan(green)
  expect(green).toBeGreaterThan(blue)
  const white = channels(6500)
  expect(Math.min(...white)).toBeGreaterThan(240)
  expect(channels(3000)[2]).toBeLessThan(channels(5000)[2])
})
test('the Studio’s lamps hang where the seed rolls them, their shadows blurred as wide as the seed rolls them, or as every lamp’s', () => {
  for (const seed of [0, ...Array.from({length: 60}, (_, index) => index + 1)]) {
    const {lamps} = studioLook(seed)
    const sandbox = seed ? new StudioSandbox(seed) : studio
    const placed = sandbox.room('studio')
    const placedLamps = sandbox.lamps()
    expect(placedLamps.map(lamp => lamp.id)).toEqual(['studio-primary-lamp', 'studio-secondary-lamp'])
    for (const [index, look] of [lamps.primary, lamps.secondary].entries()) {
      const lamp = placedLamps[index]
      expect(rounded(placed.toLocal(lamp.position))).toEqual(rounded(look.position))
      expect(lamp).toMatchObject({
        strength: look.strength,
        decay: look.decay,
        tint: look.tint,
        shadow: true,
      })
      const softShadow = lamp.kind === 'spot' ? undefined : lamp.softShadow
      if (look.blur > 0) {
        expect(softShadow?.blurAngle).toBeCloseTo(look.blur * Math.PI / 180, 12)
      } else {
        expect(softShadow).toBeUndefined()
      }
    }
  }
})
test('the Studio’s one 16:9 work hangs on its north wall 4 m from its north-western corner, and its spawn and overview look at it from 5 m in from the west wall and 4 m from the north wall, in the same place of the world whatever its size', () => {
  for (const seed of [0, 3, 17, 42, 99]) {
    const sandbox = seed ? new StudioSandbox(seed) : studio
    const slots = sandbox.portraitSlots()
    expect(slots.map(slot => [slot.wallId, slot.ratio])).toEqual([['studio-north', '16:9']])
    expect(slots.map(slot => rounded(slot.position))).toEqual([[4, 2, 0.115]])
    expect(rounded(sandbox.spawn.position)).toEqual([5, 0.04, 4])
    expect(sandbox.spawn.yaw).toBeCloseTo(15 * Math.PI / 180, 12)
    expect(sandbox.spawn.pitch).toBeCloseTo(-15 * Math.PI / 180, 12)
    // Only the Studio’s own works, all of its slot’s ratio, one of which hangs there.
    expect(sandbox.artworks.map(artwork => artwork.id)).toEqual(['chicken'])
    expect(sandbox.artworks.every(artwork => artwork.ratio === '16:9')).toBe(true)
    const [overview, ...others] = sandbox.cameraBookmarks()
    expect(others).toEqual([])
    expect(overview).toMatchObject({
      id: 'studio-overview',
      fov: 65,
    })
    expect(rounded(overview.position)).toEqual([5, 2, 4])
    expect(overview.aim.yaw).toBeCloseTo(15 * Math.PI / 180, 12)
    expect(overview.aim.pitch).toBeCloseTo(-15 * Math.PI / 180, 12)
  }
})
test('every kind of openings is listed by its id, the default seed’s ceiling cut with coffers, and seeds roll every kind', () => {
  expect(Object.keys(openingStyles).toSorted()).toEqual([...openingStyleIds].toSorted())
  for (const [id, style] of Object.entries(openingStyles)) {
    expect(style.id).toBe(id)
  }
  expect(room.room.openings.style).toBe('coffers')
  const styles = new Set(Array.from({length: 400}, (_, seed) => studioOpeningStyle(seed + 1, '')))
  expect(studioOpenings(9, [0, 1, 0], '').style).toBe(studioOpeningStyle(9, ''))
  expect(styles).toEqual(new Set(openingStyleIds))
})
test('?openings cuts the Studio’s ceiling with any kind of openings whatever the seed rolls, and ignores anything else', () => {
  for (const id of openingStyleIds) {
    expect(readOpenings(`http://localhost/?openings=${id}`)).toBe(id)
    expect(studioOpenings(7, [0, 1, 0], id).style).toBe(id)
  }
  expect(readOpenings('http://localhost/')).toBe('')
  expect(readOpenings('http://localhost/?openings=skylight')).toBe('')
  expect(readOpenings('http://localhost/?openings=toString')).toBe('')
})
test('every seed’s openings lie well inside the ceiling, each a hole of its own clear of the others by a web, without islands in it, and let in no less light than a small window', () => {
  for (const [label, {holes}, , {clear: [width, depth]}] of rolled) {
    expect(holes.length, label).toBeGreaterThan(0)
    for (const hole of holes) {
      // Outlines run counterclockwise; a clockwise one would be an island of slab in an opening, held by nothing.
      expect(area([hole]), label).toBeGreaterThan(0)
      expect(hole.reduce((sum, corner, index) => {
        const next = hole[(index + 1) % hole.length]
        return sum + corner.x * next.y - next.x * corner.y
      }, 0), label).toBeGreaterThan(0)
      expect(narrowerThan(hole, 0.03), label).toBe(false)
      for (const {x, y} of hole) {
        expect(Math.abs(x), label).toBeLessThanOrEqual(width / 2 - studioRim + 1e-6)
        expect(Math.abs(y), label).toBeLessThanOrEqual(depth / 2 - studioRim + 1e-6)
      }
    }
    // Grown by half the narrowest web, the holes still keep apart.
    expect(unite(inset(holes, -0.015)).length, label).toBe(holes.length)
    expect(area(holes), label).toBeGreaterThan(0.2)
  }
})
test('the light the openings let in falls as the pattern of the openings shifted away from the light, most of every pattern letting it through the slab', () => {
  for (const [label, {holes, middle, pool}, toLight, {height}] of rolled) {
    const [shiftX, shiftZ] = ceilingShift(toLight, height + studioSlab)
    expect(middle.x - pool.x, label).toBeCloseTo(shiftX, 9)
    expect(middle.y - pool.y, label).toBeCloseTo(shiftZ, 9)
    // Light comes through where a hole at the slab’s top lies over the same hole at its underside, which the slant shifts against each other: most of every pattern still lets it through.
    const [throughX, throughZ] = ceilingShift(toLight, studioSlab)
    const through = intersect(holes, translate(holes, point(-throughX, -throughZ)))
    expect(area(through) / area(holes), label).toBeGreaterThan(0.45)
  }
})
test('the openings spread over most of the ceiling, every seed’s well over halfway to its rim either way', () => {
  let covered = 0
  for (const [label, {holes, middle}, , {clear}] of rolled) {
    const [x, y] = openingSpread(clear)
    const extent = reach(translate(holes, point(-middle.x, -middle.y)))
    expect(extent.x / x, label).toBeGreaterThan(0.55)
    expect(extent.y / y, label).toBeGreaterThan(0.55)
    covered += extent.x * extent.y / (x * y)
  }
  expect(covered / rolled.length).toBeGreaterThan(0.85)
})
test('every layout keeps its motifs within the spread and a gap apart, round ones as circles and others as boxes, and covers it to its edges', () => {
  const ways = {
    field,
    flanked,
    grid,
    row,
    staggered,
    medallion: (spread: Spread, options: LayoutOptions) => medallion(spread, options, 0.85),
  }
  for (const [x, y] of [[1, 1], [2.8, 1.9], [5.4, 1], [3, 3], [1.4, 3.4], [5.4, 3.4], [4, 2.6]]) {
    for (const [gap, wanted, least] of [[0.12, 0.32, 0.45], [0.3, 0.9, 0.6], [0.5, 1.5, 0.45]]) {
      for (const [round, stretches] of [[true, false], [false, false], [false, true]]) {
        const options = {
          gap,
          least,
          round,
          stretches,
          wanted,
        }
        for (const [kind, way] of Object.entries(ways)) {
          const slots = way({
            x,
            y,
          }, options)
          const label = `${kind} in ${x} × ${y}, ${JSON.stringify(options)}`
          if (!slots) {
            expect(kind, label).not.toBe('row')
            expect(kind, label).not.toBe('grid')
            continue
          }
          expect(slots.length, label).toBeGreaterThan(0)
          const [edgeX, edgeY] = [Math.max(...slots.map(slot => Math.abs(slot.middle.x) + slot.reach.x)), Math.max(...slots.map(slot => Math.abs(slot.middle.y) + slot.reach.y))]
          expect(edgeX, label).toBeLessThanOrEqual(x + 1e-9)
          expect(edgeY, label).toBeLessThanOrEqual(y + 1e-9)
          // To the edges along the longer axis at least, and the shorter one too where the motifs can stretch.
          expect(Math.max(edgeX / x, edgeY / y), label).toBeCloseTo(1, 9)
          if (stretches && kind !== 'flanked') {
            expect(Math.min(edgeX / x, edgeY / y), label).toBeCloseTo(1, 9)
          }
          for (const [index, {middle, reach: extent}] of slots.entries()) {
            if (!stretches) {
              expect(extent.x, label).toBe(extent.y)
            }
            for (const other of slots.slice(index + 1)) {
              const apart = round ? Math.hypot(other.middle.x - middle.x, other.middle.y - middle.y) - extent.x - other.reach.x : Math.max(Math.abs(other.middle.x - middle.x) - extent.x - other.reach.x, Math.abs(other.middle.y - middle.y) - extent.y - other.reach.y)
              expect(apart, label).toBeGreaterThanOrEqual(gap - 1e-9)
            }
          }
        }
      }
    }
  }
})
test('every outline fills the box it reaches, stretched along its longer side, convex and counterclockwise', () => {
  for (const reachOf of [{
    x: 1,
    y: 1,
  }, {
    x: 3,
    y: 1.2,
  }, {
    x: 0.8,
    y: 2.5,
  }]) {
    for (const kind of outlineKinds) {
      const [shape] = outline(kind, reachOf)
      const extent = reach([shape])
      // Round edges stray up to 1.5 mm inside their curves.
      expect(extent.x, kind).toBeCloseTo(reachOf.x, 2)
      // A hexagon keeps its corners on the longer axis, a regular one falling short across it.
      expect(extent.y, kind).toBeCloseTo(kind === 'hexagon' && reachOf.x >= reachOf.y ? Math.min(reachOf.y, reachOf.x * Math.sqrt(3) / 2) : reachOf.y, 2)
      expect(extent.x, kind).toBeLessThanOrEqual(reachOf.x + 1e-9)
      expect(extent.y, kind).toBeLessThanOrEqual(reachOf.y + 1e-9)
      for (const [index, corner] of shape.entries()) {
        const [next, after] = [shape[(index + 1) % shape.length], shape[(index + 2) % shape.length]]
        expect((next.x - corner.x) * (after.y - next.y) - (next.y - corner.y) * (after.x - next.x), kind).toBeGreaterThanOrEqual(-1e-9)
      }
    }
  }
})
test('Voronoi cells cut by the sites nearby alone are those every site cuts, tiling their bounds', () => {
  const bounds = [point(-5, -3), point(5, -3), point(5, 3), point(-5, 3)]
  let state = 7
  const random = () => (state = state * 16_807 % 2_147_483_647) / 2_147_483_647
  const sites = Array.from({length: 600}, () => point(random() * 10 - 5, random() * 6 - 3))
  const cells = voronoiCells(sites, bounds)
  expect(cells).toHaveLength(sites.length)
  expect(cells.reduce((sum, cell) => sum + area([cell]), 0)).toBeCloseTo(60, 6)
  for (const [index, site] of sites.entries()) {
    // Each cell holds its own site and no corner of it lies nearer any other.
    expect(contains([cells[index]], site)).toBe(true)
    for (const corner of cells[index]) {
      const own = Math.hypot(corner.x - site.x, corner.y - site.y)
      expect(sites.every(other => Math.hypot(corner.x - other.x, corner.y - other.y) >= own - 1e-9)).toBe(true)
    }
  }
})
test('the Studio’s ceiling is a slab over the walls, its underside at their height facing down into the room and its top facing up wherever its openings leave it, its sides facing into the openings and out of its edge', () => {
  // The default seed’s coffers, and a large perforated field in another seed’s room.
  const other = new StudioSandbox(12)
  const perforated = other.room('studio')
  for (const [{height, size}, holes] of [[room, room.room.openings.holes], [perforated, studioOpenings(12, moonDirectionOf(studioLook(12)), 'perforated').holes]] as const) {
    const [width, depth] = size
    const geometry = ceilingGeometry({
      height,
      holes,
      size,
      slab: studioSlab,
    })
    geometry.computeBoundingBox()
    const {min, max} = geometry.boundingBox!
    for (const [value, expected] of [[min.x, -width / 2], [min.y, height], [min.z, -depth / 2], [max.x, width / 2], [max.y, height + studioSlab], [max.z, depth / 2]]) {
      expect(value).toBeCloseTo(expected, 5)
    }
    const position = geometry.getAttribute('position')
    const normals = geometry.getAttribute('normal')
    const index = geometry.getIndex()!
    const [a, b, c, normal] = [new Vector3, new Vector3, new Vector3, new Vector3]
    let [underside, top, sides] = [0, 0, 0]
    for (let corner = 0; corner < index.count; corner += 3) {
      a.fromBufferAttribute(position, index.getX(corner))
      b.fromBufferAttribute(position, index.getX(corner + 1))
      c.fromBufferAttribute(position, index.getX(corner + 2))
      const facing = b.clone().sub(a).cross(c.clone().sub(a))
      // Corners in a row along a straight edge leave slivers of well under a square millimeter, whose winding the positions’ float precision leaves to chance.
      if (facing.length() < 1e-6) {
        continue
      }
      // Every face winds toward the way its corners face.
      normal.fromBufferAttribute(normals, index.getX(corner))
      expect(facing.dot(normal)).toBeGreaterThan(0)
      if (facing.y === 0) {
        sides += facing.length() / 2
      } else if (facing.y < 0) {
        expect(a.y).toBeCloseTo(height, 5)
        underside += facing.length() / 2
      } else {
        expect(a.y).toBeCloseTo(height + studioSlab, 5)
        top += facing.length() / 2
      }
    }
    // The faces looking down and up each add up to the slab less its openings, and the sides to the rims round them all.
    const rims = [...holes, [point(0, 0), point(width, 0), point(width, depth), point(0, depth)]].reduce((sum, rim) => sum + rim.reduce((length, from, corner) => length + Math.hypot(rim[(corner + 1) % rim.length].x - from.x, rim[(corner + 1) % rim.length].y - from.y), 0), 0)
    expect(underside).toBeCloseTo(width * depth - area(holes), 2)
    expect(top).toBeCloseTo(width * depth - area(holes), 2)
    expect(sides).toBeCloseTo(rims * studioSlab, 2)
    geometry.dispose()
  }
})
test('the Studio keeps the Cell’s finishes in the default environment and rolls its walls’ and floor’s apart from each other for other seeds, every one of them in some', () => {
  expect([studioWallId(0), studioFloorId(0)]).toEqual(['cell', 'cell'])
  const seedRange = Array.from({length: 300}, (_, index) => index + 1)
  expect(new Set<string>(seedRange.map(seed => studioWallId(seed)))).toEqual(new Set(Object.keys(studioWalls)))
  expect(new Set<string>(seedRange.map(seed => studioFloorId(seed)))).toEqual(new Set(Object.keys(studioFloors)))
  expect(seedRange.some(seed => studioWallId(seed) !== studioFloorId(seed))).toBe(true)
  expect(studioWallId(7)).toBe(studioWallId(7))
})
test('every finish of the Studio loads and makes the materials of each of its walls, a floor’s mirror only where reflections are on, but for the mirrorless concrete and slate', async () => {
  const walls = studio.walls.filter(wall => wall.room === room.id)
  for (const [id, wallFinish] of Object.entries(studioWalls)) {
    expect(wallFinish.title, id).toBeTruthy()
    const finish = (await wallFinish.load())({
      center: room.center,
      size: room.size,
      walls,
    })
    for (const wall of walls) {
      expect(finish.surface(wall).isMaterial, id).toBe(true)
      expect(finish.trim(wall)?.isMaterial ?? true, id).toBe(true)
    }
    finish.dispose()
  }
  for (const [id, floorFinish] of Object.entries(studioFloors)) {
    expect(floorFinish.title, id).toBeTruthy()
    // The Cell’s wood draws its texture on a canvas, which Bun has none of.
    if (id === 'cell') {
      continue
    }
    const make = await floorFinish.load()
    for (const reflections of [false, true]) {
      const finish = make({
        anisotropy: 4,
        center: room.center,
        reflections,
        size: room.size,
      })
      expect(finish.material.isMaterial).toBe(true)
      if (!reflections || id === 'oculus' || id === 'moonfall') {
        expect(finish.material.reflectionTarget ?? null, id).toBeNull()
      } else {
        expect(finish.material.reflectionTarget, id).toBeTruthy()
      }
      finish.dispose()
    }
  }
})
test('the Studio’s design holds every value its seed rolls, its primary lamp placed from the north-western corner in meters, its secondary one in shares of the room, and gives back the seed’s plan and look', () => {
  expect(studioDesign(0, '')).toMatchObject({
    width: 8,
    depth: 8,
    height: 8,
    openings: 'coffers',
    variant: 0,
    primaryLampX: 4,
    primaryLampHeight: 4,
    primaryLampZ: 4,
    primaryLampRange: 20,
    secondaryLampStrength: 5,
    secondaryLampColor: '#4d5e7d',
    secondaryLampDecay: 1,
    secondaryLampX: 0.1,
    secondaryLampHeight: 0.4,
    secondaryLampZ: 0.7,
    secondaryLampRange: 25,
    secondaryLampBlur: 1,
    lightStrength: 5,
    lightShafts: 0.05,
    hemisphere: 0.3,
    walls: 'cell',
    floor: 'cell',
    mirrorBlur: 10,
    mirrorLoss: 0,
    frame: 'louis',
  })
  for (const seed of [0, 1, 5, 12, 43, 70]) {
    const design = studioDesign(seed, '')
    expect(designPlan(design)).toEqual(studioPlan(seed))
    const look = designLook(design)
    const placed = (lamp: typeof look.lamps.primary) => ({
      ...lamp,
      position: rounded(lamp.position),
    })
    const {lamps} = studioLook(seed)
    expect({
      ...look,
      lamps: {
        primary: placed(look.lamps.primary),
        secondary: placed(look.lamps.secondary),
      },
    }).toEqual({
      ...studioLook(seed),
      lamps: {
        primary: placed(lamps.primary),
        secondary: placed(lamps.secondary),
      },
    })
    expect([design.walls, design.floor, design.openings]).toEqual([studioWallId(seed), studioFloorId(seed), studioOpeningStyle(seed, '')])
  }
})
test('a Studio of a design of its own is as large, lit and framed as it says, its openings the kind it names cut by its variant', () => {
  const design = {
    ...studioDesign(0, ''),
    width: 10,
    depth: 9,
    height: 7,
    frame: 'kumiko',
    primaryLampX: 2,
    primaryLampHeight: 4,
    primaryLampZ: 3,
    primaryLampBlur: 3,
    secondaryLampStrength: 20,
    secondaryLampX: 0.75,
    secondaryLampHeight: 0.5,
    secondaryLampZ: 0.5,
    secondaryLampRange: 0,
    secondaryLampBlur: 0,
    lightShafts: 0.2,
    openings: 'coffers',
    variant: 3,
  } as const
  const sandbox = new StudioSandbox(0, design)
  const placed = sandbox.room('studio')
  expect(placed.room.plan).toEqual({
    clear: [10, 9],
    height: 7,
  })
  expect(placed.room.frame).toBe('kumiko')
  expect(placed.room.volumetricSun).toBe(0.2)
  const [primary, secondary] = sandbox.lamps()
  expect(rounded(primary.position)).toEqual([2, 4, 3])
  expect(primary.kind === 'spot' ? undefined : primary.softShadow?.blurAngle).toBeCloseTo(3 * Math.PI / 180, 12)
  // Three quarters of the way east, halfway south and halfway up, whatever the room’s size, reaching without end.
  expect(rounded(secondary.position)).toEqual([7.5, 3.5, 4.5])
  expect(secondary.strength).toBe(20)
  expect(secondary.range).toBe(0)
  expect(primary.range).toBe(20)
  expect(secondary.kind === 'spot' ? undefined : secondary.softShadow).toBeUndefined()
  expect(placed.room.openings.style).toBe('coffers')
  const ownCut = new StudioSandbox(0, {
    ...design,
    variant: 0,
  })
  const seedsOwn = ownCut.room('studio').room.openings
  expect(seedsOwn.style).toBe('coffers')
  expect(placed.room.openings.holes).not.toEqual(seedsOwn.holes)
  expect(sandbox.tuning.map(module => module.id)).toEqual(['studio'])
})
test('the world tuning’s Studio has a control for every value of the design, whose room size and frame reload the page, and checks what it is set to', () => {
  const tuning = new StudioTuningModule(studioDesign(5, ''))
  expect(tuning.entries.keys().toArray().toSorted()).toEqual(Object.keys(tuning.initial).toSorted())
  expect(['width', 'depth', 'height', 'frame'].every(key => tuning.reloads(key))).toBe(true)
  expect(['openings', 'primaryLampX', 'secondaryLampX', 'walls', 'lightAzimuth'].some(key => tuning.reloads(key))).toBe(false)
  expect(['openings', 'variant', 'walls', 'floor'].every(key => tuning.rebuilds(key))).toBe(true)
  expect(tuning.validate('walls', 'salon')).toBe('salon')
  expect(tuning.validate('floor', 'moonfall')).toBe('moonfall')
  expect(tuning.validate('primaryLampColor', {
    hue: 87,
    saturation: 100,
    lightness: 94,
  })).toBe('#ffecc2')
  expect(tuning.validate('primaryLampBlur', 0)).toBe(0)
  expect(tuning.validate('secondaryLampStrength', 0)).toBe(0)
  expect(tuning.validate('mirrorBlur', ownMirrorBlur)).toBe(ownMirrorBlur)
  expect(() => tuning.validate('primaryLampX', tuning.initial.width + 1)).toThrow(`studio.primaryLampX is a number from 0 to ${tuning.initial.width}.`)
  expect(() => tuning.validate('secondaryLampX', 1.5)).toThrow('studio.secondaryLampX is a number from 0 to 1.')
  expect(() => tuning.validate('secondaryLampHeight', 1)).toThrow('studio.secondaryLampHeight is a number from 0 to 0.95.')
  expect(tuning.validate('primaryLampRange', 0)).toBe(0)
  expect(() => tuning.validate('primaryLampRange', 0.5)).toThrow('studio.primaryLampRange is a number from 1 to 50, or 0 for off.')
  expect(() => tuning.validate('lightAzimuth', 215.5)).toThrow('studio.lightAzimuth is an integer from 0 to 360.')
  expect(() => tuning.validate('width', 9.5)).toThrow('studio.width is an integer from 6 to 20.')
  expect(() => tuning.validate('openings', 'skylights')).toThrow('studio.openings is one of “rose” (Rose), “sunburst” (Sunburst)')
  expect(() => tuning.validate('variant', 1.5)).toThrow('studio.variant is an integer from 0 to 99.')
})
test('every seed’s Studio design lies on the steps of its controls in the world tuning, within their ranges, so the sliders reach every value a seed rolls', () => {
  for (let seed = 0; seed <= 120; seed++) {
    const tuning = new StudioTuningModule(studioDesign(seed, ''))
    for (const [key, {control, switch: valueSwitch}] of tuning.entries) {
      const value = tuning.initial[key as keyof typeof tuning.initial]
      if (control?.kind === 'color') {
        // The sliders reach whole degrees and percent, which give back the color or one close to it.
        const {hue, saturation, lightness} = tuning.tell(key, value) as TuningColor
        expect([hue, saturation, lightness].every(Number.isInteger), `seed ${seed}: ${key}`).toBe(true)
        expect(tuning.validate(key, {
          hue,
          saturation,
          lightness,
        }), `seed ${seed}: ${key}`).toMatch(/^#[\da-f]{6}$/u)
        continue
      }
      expect(tuning.validate(key, value), `seed ${seed}: ${key}`).toBe(value)
      if (control?.kind !== 'range' || value === valueSwitch?.off) {
        continue
      }
      const steps = ((value as number) - control.min) / control.step
      expect(Math.abs(steps - Math.round(steps)), `seed ${seed}: ${key} ${value}`).toBeLessThan(1e-6)
    }
  }
})
test('the Studio’s secondary lamp switches off and on again by its strength’s checkbox, back to the strength it kept, or to 20 cd if it started off, its controls but its strength doing nothing while it is off', () => {
  const control = (tuning: StudioTuningModule, key: string) => tuning.entries.get(key)!.control!
  const secondaryKeys = ['secondaryLampColor', 'secondaryLampRange', 'secondaryLampX', 'secondaryLampHeight', 'secondaryLampBlur']
  // On in the default environment.
  const lit = new StudioTuningModule(studioDesign(0, ''))
  const strength = lit.entries.get('secondaryLampStrength')!.switch!
  expect(secondaryKeys.map(key => control(lit, key).when?.(lit.initial))).toEqual(secondaryKeys.map(() => true))
  lit.switch(strength, false)
  expect(lit.get().secondaryLampStrength).toBe(0)
  expect(secondaryKeys.map(key => control(lit, key).when?.(lit.get()))).toEqual(secondaryKeys.map(() => false))
  // Back to the strength it kept.
  lit.switch(strength, true)
  expect(lit.get().secondaryLampStrength).toBe(5)
  // A seed that leaves it off switches it on to 20 cd.
  const darkSeed = Array.from({length: 50}, (_, index) => index + 1).find(seed => studioDesign(seed, '').secondaryLampStrength === 0)!
  const dark = new StudioTuningModule(studioDesign(darkSeed, ''))
  expect(dark.initialParked.secondaryLampStrength).toBe(20)
  expect('when' in control(dark, 'primaryLampX')).toBe(false)
  expect(dark.entries.get('primaryLampStrength')!.caption).toBe('Primary lamp')
  expect(dark.entries.get('secondaryLampBlur')!.caption).toBe('Secondary lamp')
})
test('a stepped roll lands on every step of its range as often as on any other, its ends too', () => {
  const counts = new Map<number, number>
  for (let index = 0; index < 4000; index++) {
    const value = rollOnStep(new StableRandom({id: ['steps', index]}), [0.5, 2], 0.5)
    counts.set(value, (counts.get(value) ?? 0) + 1)
  }
  expect(counts.keys().toArray().toSorted((a, b) => a - b)).toEqual([0.5, 1, 1.5, 2])
  for (const count of counts.values()) {
    expect(count).toBeGreaterThan(850)
    expect(count).toBeLessThan(1150)
  }
  expect(rollOnStep(new StableRandom({id: 'shares'}), [0.15, 0.85], 0.005) * 200 % 1).toBe(0)
})
test('the world tuning’s Studio switches the openings off for a plain ceiling, and the shafts, the fill lights and the mirror off to 0', () => {
  const tuning = new StudioTuningModule(studioDesign(0, ''))
  const switchOf = (key: string) => tuning.entries.get(key)!.switch!
  // The default environment’s ambient is off, its hemisphere faintly on.
  expect([tuning.initial.ambient, tuning.initialParked.ambient, tuning.initial.hemisphere, tuning.initialParked.hemisphere]).toEqual([0, 0.1, 0.3, undefined])
  for (const key of ['lightShafts', 'mirror']) {
    expect(switchOf(key).off).toBe(0)
  }
  expect(switchOf('openings')).toMatchObject({
    fallback: 'coffers',
    off: 'none',
  })
  expect(tuning.validate('openings', 'none')).toBe('none')
  tuning.switch(switchOf('openings'), false)
  expect(tuning.entries.get('variant')!.control!.when?.(tuning.get())).toBe(false)
  const plain = new StudioSandbox(0, tuning.get())
  expect(plain.room('studio').room.openings).toMatchObject({
    holes: [],
    style: 'none',
  })
  // A slab without holes: only its underside, top and four sides.
  const geometry = ceilingGeometry({
    height: 8,
    holes: [],
    size: [8, 8],
    slab: studioSlab,
  })
  expect(geometry.getIndex()!.count).toBeGreaterThan(0)
  geometry.dispose()
})
test('the Studio’s ceiling is surfaced like the walls but for the finishes laid out along each wall, which keep the plaster', async () => {
  const plastered = new Set(['salon', 'banquet'])
  for (const [id, finish] of Object.entries(studioWalls)) {
    const made = (await finish.load())({
      center: room.center,
      size: room.size,
      walls: studio.walls,
    })
    if (plastered.has(id)) {
      expect(made.ceiling, id).toBeUndefined()
    } else {
      expect(made.ceiling, id).toBe(made.surface(studio.walls[0]))
    }
    made.dispose()
  }
})
test('the world tuning tells and takes the Studio’s colors as their OkHSL hue, saturation and lightness, any left out at 0°, 100% and 50%, which the panel’s Copy button copies too', () => {
  const tuning = new WorldTuning([new StudioTuningModule(studioDesign(0, ''))])
  const module = tuning.module('studio')!
  expect(tuning.describe()[0].controls.find(control => control.key === 'secondaryLampColor')).toMatchObject({
    kind: 'color',
    value: {
      hue: 262,
      saturation: 30,
      lightness: 40,
    },
  })
  expect(tuning.set({studio: {
    lightColor: {
      saturation: 0,
      lightness: 100,
    },
    secondaryLampColor: {
      hue: 177,
      saturation: 20,
    },
  }})).toEqual([{
    module: 'studio',
    key: 'lightColor',
    from: {
      hue: 265,
      saturation: 53,
      lightness: 76,
    },
    to: {
      hue: 0,
      saturation: 0,
      lightness: 100,
    },
  }, {
    module: 'studio',
    key: 'secondaryLampColor',
    from: {
      hue: 262,
      saturation: 30,
      lightness: 40,
    },
    to: {
      hue: 177,
      saturation: 20,
      lightness: 50,
    },
  }])
  // The module holds them as #rrggbb, which a reload carries over.
  expect(tuning.changes()).toEqual({studio: {
    lightColor: '#ffffff',
    secondaryLampColor: '#637e77',
  }})
  expect(tuning.toldChanges()).toEqual({studio: {
    lightColor: {
      hue: 0,
      saturation: 0,
      lightness: 100,
    },
    secondaryLampColor: {
      hue: 177,
      saturation: 20,
      lightness: 50,
    },
  }})
  expect(tuning.describe()[0].controls.find(control => control.key === 'lightColor')?.initial).toEqual({
    hue: 265,
    saturation: 53,
    lightness: 76,
  })
  expect(module.validate('primaryLampColor', {})).toBe('#d70071')
  expect(module.validate('primaryLampColor', {hue: 360})).toBe('#d70071')
  for (const value of ['#ffffff', {hue: 361}, {saturation: -1}, {lightness: '50'}, {
    hue: 0,
    alpha: 1,
  }, [0, 100, 50], null]) {
    expect(() => module.validate('lightColor', value)).toThrow('studio.lightColor is a color as its OkHSL {hue, saturation, lightness}: a hue from 0 to 360°, a saturation and a lightness from 0 to 100%, any left out at 0°, 100% and 50%.')
  }
  tuning.set({studio: {lightColor: null}})
  expect(module.get().lightColor).toBe(module.initial.lightColor)
})
