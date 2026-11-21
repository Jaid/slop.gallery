import type {OverlayLineStyle, OverlayTuning} from '#src/lib/overlay/tuning.ts'

import {initialOverlayTuning, overlayLineWidth, useOverlayTuning} from '#src/lib/overlay/tuning.ts'
import {changeTunedGraphics} from '#src/lib/rendering/tuningBuffer.ts'

import css from './style.module.sass'

const tune = (settings: Partial<OverlayTuning>) => changeTunedGraphics(() => useOverlayTuning.setState(settings))

export default function OverlayLineControls() {
  const {lineStyle, lineWidth} = useOverlayTuning()
  const changed = lineStyle !== initialOverlayTuning.lineStyle || lineWidth !== initialOverlayTuning.lineWidth
  return <fieldset className={css.section}>
    <legend data-changed={changed || undefined} onDoubleClick={() => tune(initialOverlayTuning)}>World overlay</legend>
    <label className={css.row}><span data-changed={lineStyle !== initialOverlayTuning.lineStyle || undefined} onDoubleClick={() => tune({lineStyle: initialOverlayTuning.lineStyle})}>Line style</span>
      <select aria-label='Overlay line style' value={lineStyle} onChange={event => tune({lineStyle: event.currentTarget.value as OverlayLineStyle})}><option value='aliased'>Aliased pixels</option><option value='barycentric'>Barycentric (antialiased)</option></select>
    </label>
    <label className={css.row}><span data-changed={lineWidth !== initialOverlayTuning.lineWidth || undefined} onDoubleClick={() => tune({lineWidth: initialOverlayTuning.lineWidth})}>Line thickness</span>
      <input id='tuning-overlay-width' max={overlayLineWidth.max} min={overlayLineWidth.min} step={overlayLineWidth.step} type='range' value={lineWidth} onChange={event => tune({lineWidth: event.currentTarget.valueAsNumber})} />
      <output htmlFor='tuning-overlay-width'>{lineWidth}</output>
    </label>
    <p className={css.hint}>Layers inherit these settings unless they specify their own. Width 100 is 1 px at 1920×1080 and scales with the square root of the viewport area.</p>
    <input className={css.parameter} aria-label='Overlay outline URL parameters' readOnly value={`&line_style=${lineStyle}&line_width=${lineWidth}`} onFocus={event => event.currentTarget.select()} />
  </fieldset>
}
