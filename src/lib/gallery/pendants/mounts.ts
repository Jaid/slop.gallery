import type Passage from '../passages/Passage.ts'
import type RoutedPassage from '../passages/RoutedPassage.ts'
import type {Vec3} from '../types.ts'
import type {PendantMount} from './CeilingProbe.ts'
import type {BufferGeometry} from 'three/webgpu'

import {timberRibSpacing} from '../passages/timberLayout.ts'
import CeilingProbe from './CeilingProbe.ts'

/** how far a passage’s lights hang under its crown */
export const passageLightDrop = 0.6
/** At most this far between two passage lights along a span. */
export const passageLightSpacing = 5
/** how far a light may slide to reach a timber rib: half the most the ribs are apart, plus enough to cross from an elbow’s flat roof slab to the first rib past it */
export const ribSearch = timberRibSpacing / 2 + 0.15
/** A rib is barely wider than a canopy, so the search for one goes in 1 cm steps not to skip over it. */
const ribStep = 0.01

/** How many lights a span of the passage gets, at most `spacing` apart: at least one. */
export function passageLightCount(passage: Passage, span: number, spacing = passageLightSpacing) {
  return Math.max(1, Math.ceil(passage.spans[span].length / spacing))
}

/** The light of the lantern `index` of the passage’s span, counted from the span’s start, under the crown: the span’s lights hang evenly spaced along it, see {@link passageLightCount}. */
export function passageLight(passage: Passage, span: number, index: number, spacing = passageLightSpacing): Vec3 {
  const {start, end} = passage.spans[span]
  const t = (index + 0.5) / passageLightCount(passage, span, spacing)
  return [start[0] + (end[0] - start[0]) * t, passage.floorY + passage.height - passageLightDrop, start[1] + (end[1] - start[1]) * t]
}

/**
 * Evenly spaced lights along every span, hung from the vault, timber lining or the flat roof slabs over the elbows. Given timber
 * `ribs`, each light hangs from the nearest one instead where one is in reach.
 */
export function passagePendantMounts(passage: Passage, surfaces: ReadonlyArray<BufferGeometry>, spacing = passageLightSpacing, ribs?: BufferGeometry): Array<PendantMount> {
  const probe = new CeilingProbe(surfaces, [
    {
      y: passage.floorY + passage.height,
      areas: passage.floors,
    },
  ])
  const ribProbe = ribs && new CeilingProbe([ribs])
  return passage.spans.flatMap(({start, end}, span) => Array.from({length: passageLightCount(passage, span, spacing)}, (_, index) => {
    const light = passageLight(passage, span, index, spacing)
    const along: Vec3 = [end[0] - start[0], 0, end[1] - start[1]]
    return ribProbe?.mount(light, along, ribSearch, ribStep) ?? mountOrThrow(probe, light, along, `${passage.id} span ${span}`)
  }))
}

/** The light of a lantern `along` meters down a routed passage, under its crown, which lies midway between its walls. */
export function routeLight(passage: RoutedPassage, along: number): Vec3 {
  const station = passage.route.at(along)
  const {point: [x, z], heading, y, height} = station
  const middle = (passage.reach(station, 1) - passage.reach(station, -1)) / 2
  return [x - Math.sin(heading) * middle, y + height - passageLightDrop, z + Math.cos(heading) * middle]
}

/** Lights hung from a routed passage’s vault at the distances along its route, each sliding along the route to a spot wide enough for its canopy. */
export function routePendantMounts(passage: RoutedPassage, surfaces: ReadonlyArray<BufferGeometry>, stations: ReadonlyArray<number>): Array<PendantMount> {
  const probe = new CeilingProbe(surfaces)
  return stations.map(along => {
    const {heading} = passage.route.at(along)
    return mountOrThrow(probe, routeLight(passage, along), [Math.cos(heading), 0, Math.sin(heading)], `${passage.name} at ${along.toFixed(2)} m`)
  })
}

function mountOrThrow(probe: CeilingProbe, light: Vec3, along: Vec3, label: string) {
  const mount = probe.mount(light, along)
  if (!mount) {
    throw new RangeError(`No ceiling area near ${label} is wide enough to hang a pendant from.`)
  }
  return mount
}
