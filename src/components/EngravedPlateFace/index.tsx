import Branch from 'branch-component'

import engravedPlate from '#src/lib/gallery/engravedPlate.ts'

import css from './style.module.sass'

/** What an engraved plate’s face is cut with: its heading over its byline inside a double rule, white where the graver cut on black where it left the metal. */
export default function EngravedPlateFace({byline, heading}: {
  byline?: string
  heading: string
}) {
  const [width, height] = engravedPlate.texture
  return <div
    className={css.face} style={{
      width,
      height,
    }}
  >
    <div className={css.outerRule} />
    <div className={css.innerRule} />
    <div className={byline ? `${css.line} ${css.heading}` : `${css.line} ${css.heading} ${css.alone}`}>{heading}</div>
    <Branch if={byline}><div className={`${css.line} ${css.byline}`}>{byline}</div></Branch>
  </div>
}
