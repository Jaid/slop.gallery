import type {TuningSource} from './base/TuningModule.ts'
import type {TuningGroup} from './controls.ts'
import type {ToneMapping} from 'three/webgpu'

import {clamp} from 'math'
import {ACESFilmicToneMapping, AgXToneMapping, CineonToneMapping, LinearToneMapping, NeutralToneMapping, NoToneMapping, ReinhardToneMapping} from 'three/webgpu'

import {defaultFov, fovLimits, fovStep, readFov} from '#src/lib/rendering/fov.ts'
import {readScale} from '#src/lib/rendering/scale.ts'

import TuningModule from './base/TuningModule.ts'
import {scaleOptions, tuningControls} from './controls.ts'

/** the tone mappings the view picks from by id, with three’s constant for each */
export const toneMappings = {
  aces: ACESFilmicToneMapping,
  agx: AgXToneMapping,
  neutral: NeutralToneMapping,
  reinhard: ReinhardToneMapping,
  cineon: CineonToneMapping,
  linear: LinearToneMapping,
  none: NoToneMapping,
} as const satisfies Record<string, ToneMapping>

export type ToneMappingId = keyof typeof toneMappings

/** How the camera sees and the canvas resolves. */
export type ViewValues = {
  /** vertical field of view of the game camera in degrees */
  fov: number
  /** renderer pixels per physical display pixel */
  renderScale: number
  /** the tone mapping of the render pipeline, see {@link toneMappings} */
  toneMapping: ToneMappingId
}

const {group, range, select} = tuningControls<ViewValues>()
const renderScales = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2]

/** The view: the field of view, which applies in every graphics mode, the canvas’ scale and the tone mapping. It starts from the permalink’s field of view and scale and the tone mapping React Three Fiber sets up. */
export default class ViewTuningModule extends TuningModule<ViewValues> {
  override readonly groups: ReadonlyArray<TuningGroup<ViewValues>> = [group({
    title: 'View',
    controls: [
      // The page’s own scale too, if it is none of the usual ones.
      select('renderScale', 'Scale', scaleOptions([...new Set([...renderScales, this.initial.renderScale])].toSorted((a, b) => a - b))),
      range('fov', 'Field of view', ...fovLimits, 1, {unit: '°'}),
      select('toneMapping', 'Tone mapping', [['aces', 'ACES Filmic'], ['agx', 'AgX'], ['neutral', 'Neutral'], ['reinhard', 'Reinhard'], ['cineon', 'Cineon'], ['linear', 'Linear'], ['none', 'None']]),
    ],
  })]

  override readonly id = 'view'
  override readonly title = 'View'

  constructor() {
    super({
      fov: readFov() ?? defaultFov,
      renderScale: readScale() ?? 1,
      toneMapping: 'aces',
    })
  }

  /**
   * Widens the field of view by {@link fovStep} degrees, or narrows it for a `direction` of −1, within {@link fovLimits}, returning the new one.
   * One beyond them, like a `?fov` of 2, only moves back toward them.
   */
  stepFov(direction: -1 | 1, source: TuningSource = 'key') {
    const {fov} = this.get()
    const [narrowest, widest] = fovLimits
    const stepped = clamp(fov + direction * fovStep, Math.min(fov, narrowest), Math.max(fov, widest))
    this.set({fov: stepped}, source)
    return stepped
  }
}

/** the view of the world tuning */
export const viewTuning = new ViewTuningModule
