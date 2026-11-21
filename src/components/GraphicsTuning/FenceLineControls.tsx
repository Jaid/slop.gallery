import type {FenceLineStyle, FenceTuning} from '#src/lib/gallery/fenceDisplay.ts'

import {fenceLineWidth, initialFenceTuning, useFenceDisplay} from '#src/lib/gallery/fenceDisplay.ts'
import {changeTunedGraphics} from '#src/lib/rendering/tuningBuffer.ts'

import css from './style.module.sass'

const tune = (settings: Partial<FenceTuning>) => changeTunedGraphics(() => useFenceDisplay.setState(settings))

export default function FenceLineControls() {
  const {lineStyle, lineWidth} = useFenceDisplay()
  const changed = lineStyle !== initialFenceTuning.lineStyle || lineWidth !== initialFenceTuning.lineWidth
  return <fieldset className={css.section}>
    <legend data-changed={changed || undefined} onDoubleClick={() => tune(initialFenceTuning)}>Fence outlines</legend>
    <label className={css.row}><span data-changed={lineStyle !== initialFenceTuning.lineStyle || undefined} onDoubleClick={() => tune({lineStyle: initialFenceTuning.lineStyle})}>Line style</span>
      <select aria-label='Fence line style' value={lineStyle} onChange={event => tune({lineStyle: event.currentTarget.value as FenceLineStyle})}><option value='aliased'>Aliased pixels</option><option value='barycentric'>Barycentric (antialiased)</option></select>
    </label>
    <label className={css.row}><span data-changed={lineWidth !== initialFenceTuning.lineWidth || undefined} onDoubleClick={() => tune({lineWidth: initialFenceTuning.lineWidth})}>Line thickness</span>
      <input id='tuning-fence-width' max={fenceLineWidth.max} min={fenceLineWidth.min} step={fenceLineWidth.step} type='range' value={lineWidth} onChange={event => tune({lineWidth: event.currentTarget.valueAsNumber})} />
      <output htmlFor='tuning-fence-width'>{lineWidth}</output>
    </label>
    <p className={css.hint}>Width 100 is 1 px at a 1080 px short edge.</p>
    <input className={css.parameter} aria-label='Fence outline URL parameters' readOnly value={`&line_style=${lineStyle}&line_width=${lineWidth}`} onFocus={event => event.currentTarget.select()} />
  </fieldset>
}
