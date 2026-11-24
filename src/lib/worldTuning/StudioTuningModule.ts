import type {StudioDesign} from '#src/rooms/studio/design.ts'
import type {TuningControl, TuningGroup, TuningOption} from './controls.ts'

import {frameIds} from '#src/frames/lib/frameParameter.ts'
import {environmentSeed} from '#src/lib/gameSeed.ts'
import {chandelierRange} from '#src/rooms/lib/sandboxFinish.ts'
import {ownMirrorBlur, studioDesign} from '#src/rooms/studio/design.ts'
import {studioFloorIds, studioFloors, studioWallIds, studioWalls} from '#src/rooms/studio/finishes.ts'
import {defaultOpeningStyle} from '#src/rooms/studio/openings/index.ts'
import {noOpenings, openingStyleIds} from '#src/rooms/studio/openings/openingParameter.ts'
import {studioSteps} from '#src/rooms/studio/steps.ts'

import TuningModule from './base/TuningModule.ts'
import {tuningControls} from './controls.ts'

const {color, group, percent, range, select} = tuningControls<StudioDesign>()
/** whether the ceiling has openings */
const isCut = (design: StudioDesign) => design.openings !== noOpenings
/** whether the secondary lamp is switched on */
const secondaryLit = (design: StudioDesign) => design.secondaryLampStrength > 0
/** The controls of a lamp, the primary or the secondary one: its `strength`, which starts its part of the group, color, decay, how far it reaches, where it hangs along `x` and `z` and how high, and how wide its shadow blurs, those after its strength only doing anything `when` it says. */
const lampControls = (lamp: 'primary' | 'secondary', {height, strength, x, z}: Record<'height' | 'strength' | 'x' | 'z', TuningControl<StudioDesign>>, when?: (design: StudioDesign) => boolean): Array<TuningControl<StudioDesign>> => {
  const applies = when ? {when} : {}
  return [
    strength,
    color(`${lamp}LampColor`, 'Color', applies),
    range(`${lamp}LampDecay`, 'Decay', 0, 3, studioSteps.lampDecay, applies),
    range(`${lamp}LampRange`, 'Range', 1, 50, studioSteps.lampRange, {
      off: {
        fallback: chandelierRange,
        off: 0,
      },
      unit: ' m',
      ...applies,
    }),
    x,
    z,
    height,
    range(`${lamp}LampBlur`, 'Shadow blur', studioSteps.lampBlur, 8, studioSteps.lampBlur, {
      off: {
        fallback: 2,
        off: 0,
      },
      unit: '°',
      ...applies,
    }),
  ]
}
const capitalized = (id: string) => `${id[0].toUpperCase()}${id.slice(1)}`
const idOptions = (ids: ReadonlyArray<string>): Array<TuningOption> => ids.map(id => [id, capitalized(id)])
/** the values that build something anew: the ceiling for other openings, materials for other finishes */
const rebuilding: ReadonlySet<string> = new Set(['openings', 'variant', 'walls', 'floor'])

/**
 * The Studio of the Sandbox, which brings it along: everything it is built and lit from, see {@link StudioDesign}, starting from what this game’s seed rolls.
 * All of it applies live but its size, which shapes its walls, colliders and slots, and its frame, which every hung work wears: they reload the page, carrying every tuned value over.
 */
export default class StudioTuningModule extends TuningModule<StudioDesign> {
  override readonly groups: ReadonlyArray<TuningGroup<StudioDesign>>

  override readonly title = 'Studio'

  constructor(design = studioDesign(environmentSeed)) {
    super('studio', design)
    // Positions reach across the room as it is built, which may be a size a reload carried over.
    const {depth, height, width} = this.get()
    this.groups = [group({
      title: 'Studio',
      controls: [
        range('width', 'Width', 6, 20, studioSteps.size, {
          caption: 'Room',
          integer: true,
          reloads: true,
          unit: ' m',
        }),
        range('depth', 'Depth', 6, 20, studioSteps.size, {
          integer: true,
          reloads: true,
          unit: ' m',
        }),
        range('height', 'Height', 6, 12, studioSteps.size, {
          integer: true,
          reloads: true,
          unit: ' m',
        }),
        select('openings', 'Style', idOptions(openingStyleIds), {
          caption: 'Openings',
          off: {
            fallback: defaultOpeningStyle,
            off: noOpenings,
          },
        }),
        range('variant', 'Variant', 0, 99, 1, {
          integer: true,
          when: isCut,
        }),
        color('lightColor', 'Color', {caption: 'Moon or sun'}),
        range('lightAzimuth', 'Azimuth', 0, 360, studioSteps.lightAngle, {
          integer: true,
          unit: '°',
        }),
        range('lightElevation', 'Elevation', 20, 90, studioSteps.lightAngle, {
          integer: true,
          unit: '°',
        }),
        range('lightStrength', 'Strength', 0, 24, studioSteps.lightStrength),
        percent('lightShafts', 'Shafts', studioSteps.lightShafts, 1, studioSteps.lightShafts, {off: {
          fallback: 0.1,
          off: 0,
        }}),
        range('lightBlur', 'Shadow blur', 0.5, 6, studioSteps.lightBlur, {unit: '×'}),
        ...lampControls('primary', {
          strength: range('primaryLampStrength', 'Strength', 0, 120, studioSteps.lampStrength, {
            caption: 'Primary lamp',
            unit: ' cd',
          }),
          x: range('primaryLampX', 'X', 0, width, studioSteps.lampPlace, {unit: ' m'}),
          z: range('primaryLampZ', 'Z', 0, depth, studioSteps.lampPlace, {unit: ' m'}),
          height: range('primaryLampHeight', 'Height', 0.5, height - 0.2, studioSteps.lampPlace, {unit: ' m'}),
        }),
        ...lampControls('secondary', {
          strength: range('secondaryLampStrength', 'Strength', studioSteps.lampStrength, 120, studioSteps.lampStrength, {
            caption: 'Secondary lamp',
            off: {
              fallback: 20,
              off: 0,
            },
            unit: ' cd',
          }),
          x: percent('secondaryLampX', 'X', 0, 1, studioSteps.lampShare, {when: secondaryLit}),
          z: percent('secondaryLampZ', 'Z', 0, 1, studioSteps.lampShare, {when: secondaryLit}),
          height: percent('secondaryLampHeight', 'Height', 0, 0.95, studioSteps.lampShare, {when: secondaryLit}),
        }, secondaryLit),
        range('ambient', 'Ambient', studioSteps.fill, 0.5, studioSteps.fill, {
          caption: 'Fill',
          off: {
            fallback: 0.1,
            off: 0,
          },
        }),
        range('hemisphere', 'Hemisphere', studioSteps.fill, 1.5, studioSteps.fill, {off: {
          fallback: 0.5,
          off: 0,
        }}),
        select('walls', 'Walls', studioWallIds.map(id => [id, studioWalls[id].title]), {caption: 'Finishes'}),
        select('floor', 'Floor', studioFloorIds.map(id => [id, studioFloors[id].title])),
        percent('mirror', 'Mirror', studioSteps.mirror, 3, studioSteps.mirror, {off: {
          fallback: 1,
          off: 0,
        }}),
        range('mirrorBlur', 'Mirror blur', 0, 32, studioSteps.mirrorBlur, {
          off: {
            fallback: 8,
            off: ownMirrorBlur,
          },
          unit: ' px',
        }),
        percent('mirrorLoss', 'Mirror loss', 0, 2, studioSteps.mirror),
        select('frame', 'Frame', idOptions(frameIds), {reloads: true}),
      ],
      note: 'The primary lamp’s X and Z are world coordinates, meters east and south of the north-western corner, and its height meters over the floor; the secondary lamp’s are shares of the room’s width, depth and height, so it keeps its place in a room of another size. An unchecked range reaches without end. An unchecked style leaves the ceiling without openings. Variant 0 is the seed’s own cut of the openings. Unchecked shadow blurs are every lamp’s, an unchecked mirror blur the floor’s own, unchecked shafts, fill lights and mirror off. Mirror loss scales how coarse a mip of its mirror the floor reads, 0 being its full resolution. Room size and frame reload the page.',
    })]
  }

  override rebuilds(key: string) {
    return rebuilding.has(key)
  }
}

/** the Studio of the world tuning, which the Sandbox brings along where it holds the Studio */
export const studioTuning = new StudioTuningModule
