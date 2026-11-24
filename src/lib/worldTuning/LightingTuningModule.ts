import type {LightingTuning} from '#src/lib/gallery/lighting.ts'
import type {TuningGroup} from './controls.ts'

import {getLightingTuning, lightingPresets, useLighting} from '#src/lib/gallery/lighting.ts'

import TuningModule from './base/TuningModule.ts'
import {tuningControls} from './controls.ts'

const {group, percent, range, select} = tuningControls<LightingTuning>()

/**
 * The gallery’s lighting: its sun, its lamps and the fill, on top of the lighting preset, see `tuneLighting`. It starts from the preset the page starts with, and every value still at its start keeps following the preset, so cycling presets with L still changes it.
 * Only the gallery is lit by presets, which brings it along. World modules import it, so it must never import the current world.
 */
export default class LightingTuningModule extends TuningModule<LightingTuning> {
  override readonly groups: ReadonlyArray<TuningGroup<LightingTuning>> = [
    group({
      title: 'Sun',
      toggle: 'sun',
      controls: [
        range('sunIntensity', 'Strength', 0, 8, 0.1),
        range('sunAzimuth', 'Azimuth', 0, 360, 1, {unit: '°'}),
        range('sunElevation', 'Elevation', 0, 90, 1, {unit: '°'}),
      ],
    }),
    group({
      title: 'Lamps',
      toggle: {
        fallback: 'all',
        key: 'lampSet',
        off: 'none',
      },
      controls: [
        select('lampSet', 'Lamps', [['all', 'All'], ['essential', 'Essential']]),
        percent('lamps', 'Multiplier', 0, 4, 0.05),
        percent('lampShadows', 'Shadows', 0.05, 1, 0.05, {off: {
          fallback: 1,
          off: 0,
        }}),
      ],
    }),
    group({
      title: 'Fill',
      toggle: 'fill',
      controls: [
        range('hemisphereIntensity', 'Base light', 0.1, 4, 0.1, {off: {
          fallback: 1,
          off: 0,
        }}),
        percent('environmentIntensity', 'Environment', 0.05, 1, 0.05, {off: {
          fallback: 1,
          off: 0,
        }}),
      ],
    }),
  ]

  override readonly title = 'Lighting'

  constructor() {
    super('lighting', getLightingTuning(lightingPresets[useLighting.getState().preset]))
  }
}

/** the gallery lighting of the world tuning */
export const lightingTuning = new LightingTuningModule
