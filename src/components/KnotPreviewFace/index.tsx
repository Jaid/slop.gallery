import type {KnotBay} from 'knot-materials/exhibition.ts'

import {knotNumberLabel} from 'knot-materials/exhibition.ts'
import {knotPreviewIconMaximumHeight, knotPreviewIconMaximumWidth, knotPreviewTextureLayout} from 'knot-materials/KnotPreviewLayout.ts'

import {fitted} from '#src/lib/fitLines.ts'

import signAccentColor from '../signAccentColor.ts'

import css from './style.module.sass'

export const knotPreviewBackground = '#17202b'
/** a caption’s font size as a share of its row’s height, before it is fitted */
const captionSize = 0.13 * 0.72
/** One complete candidate billboard: every finish’s rendered picture over its number and title, in rows. A finish without a picture gets a plain square. */
export default function KnotPreviewFace({bay, images}: {
  bay: Pick<KnotBay, 'finishes'>
  images: ReadonlyMap<string, HTMLCanvasElement>
}) {
  const layout = knotPreviewTextureLayout(bay.finishes.length)
  const largest = Math.min(layout.tileWidth * knotPreviewIconMaximumWidth, layout.rowHeight * knotPreviewIconMaximumHeight)
  return <div
    className={css.face} style={{
      width: layout.width,
      height: layout.height,
      background: knotPreviewBackground,
      fontSize: Math.max(12, Math.floor(layout.rowHeight * captionSize)),
    }}
  >
    {rowsOf(bay.finishes, layout.rowCounts).map((finishes, row) => <div key={row} className={css.row} style={{height: layout.rowHeight}}>
      {finishes.map(finish => {
        const image = images.get(finish.id)
        const aspect = image ? image.width / image.height : 1
        return <div key={finish.id} className={css.tile} style={{width: layout.tileWidth}}>
          <div
            className={image ? css.picture : `${css.picture} ${css.failed}`} style={{
              width: aspect >= 1 ? largest : largest * aspect,
              height: aspect >= 1 ? largest / aspect : largest,
            }} ref={holder => {
              if (image) {
                holder?.append(image)
              }
            }}
          />
          <div className={css.caption} style={{color: signAccentColor(finish.placeholder.color)}} {...fitted}>{knotNumberLabel(finish.number)} · {finish.title}</div>
        </div>
      })}
    </div>)}
  </div>
}

/** the finishes of every row, from the top */
function rowsOf(finishes: KnotBay['finishes'], rowCounts: ReadonlyArray<number>) {
  let taken = 0
  return rowCounts.map(count => {
    const row = finishes.slice(taken, taken + count)
    taken += count
    return row
  })
}
