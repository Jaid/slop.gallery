import type {KnotLabel} from '#src/components/KnotLabels/layout.ts'

import Branch from 'branch-component'
import {unknown} from 'knot-materials/rarities.ts'

import {knotDetailLine, labelAtlasColumns, labelBackground, labelHeight, labelWidth} from '#src/components/KnotLabels/layout.ts'
import {cssHex} from '#src/lib/color.ts'

import signAccentColor from '../signAccentColor.ts'

import css from './style.module.sass'

/** A nameplate’s complete face: number, title, rarity stars, model with its mark, and how it was made. */
export default function KnotLabelFace({exhibit}: {exhibit: KnotLabel}) {
  const detail = knotDetailLine(exhibit.harness, exhibit.author.model.effortLevel)
  const accent = signAccentColor(exhibit.placeholder.color)
  return <div
    className={css.plate} style={{
      width: labelWidth,
      height: labelHeight,
      background: cssHex(labelBackground),
    }}
  >
    <div className={css.accent} style={{background: accent}} />
    <div className={`${css.line} ${css.number}`}>{exhibit.label}</div>
    <div className={`${css.line} ${css.title}`} style={{color: accent}}>{exhibit.title}</div>
    <Branch if={exhibit.rarity !== unknown}><div className={`${css.line} ${css.rarity}`}>{Array.from({length: exhibit.rarity}, () => '★').join(' ')}</div></Branch>
    <div className={css.model}>
      {exhibit.candidate?.icon && <img className={css.icon} alt='' src={exhibit.candidate.icon} />}
      <span className={css.modelTitle}>{exhibit.modelTitle}</span>
    </div>
    {detail && <div className={`${css.line} ${css.detail}`}>{detail}</div>}
  </div>
}

/** Every nameplate’s face in one atlas, row by row. */
export function KnotLabelFaces({exhibits}: {exhibits: ReadonlyArray<KnotLabel>}) {
  return <div
    style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${labelAtlasColumns}, ${labelWidth}px)`,
      width: labelAtlasColumns * labelWidth,
    }}
  >
    {exhibits.map(exhibit => <KnotLabelFace key={exhibit.id} exhibit={exhibit} />)}
  </div>
}
