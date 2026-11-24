import type {OverlayTuning} from '#src/lib/overlay/tuning.ts'
import type {TuningGroup} from './controls.ts'

import {useSyncExternalStore} from 'react'

import overlay from '#src/lib/overlay/index.ts'
import {initialOverlayTuning, overlayLineWidth, useOverlayTuning} from '#src/lib/overlay/tuning.ts'

import TuningModule from './base/TuningModule.ts'
import {tuningControls} from './controls.ts'

const {group, range, select} = tuningControls<OverlayTuning>()

/** The lines of the world overlay that layers leave to it, which `?line_style` and `?line_width` start from. Its strokes read the values from the store of `overlay/tuning.ts`, which the module shares. The panel only shows it while something is drawn. */
export default class OverlayTuningModule extends TuningModule<OverlayTuning> {
  override readonly groups: ReadonlyArray<TuningGroup<OverlayTuning>> = [group({
    title: 'World overlay',
    controls: [
      select('lineStyle', 'Line style', [['aliased', 'Aliased pixels'], ['barycentric', 'Barycentric (antialiased)']]),
      range('lineWidth', 'Line thickness', overlayLineWidth.min, overlayLineWidth.max, overlayLineWidth.step, {integer: true}),
    ],
    note: 'Layers inherit these settings unless they specify their own. Width 100 is 1 px at 1920×1080 and scales with the square root of the viewport area.',
    parameters: ({lineStyle, lineWidth}) => `&line_style=${lineStyle}&line_width=${lineWidth}`,
  })]

  override readonly id = 'overlay'
  override readonly title = 'World overlay'

  constructor() {
    super(initialOverlayTuning, useOverlayTuning)
  }

  override isShown() {
    return overlay.hasDrawings()
  }

  override useShown() {
    return useSyncExternalStore(overlay.subscribe, overlay.hasDrawings)
  }
}

/** the overlay lines of the world tuning */
export const overlayTuning = new OverlayTuningModule
