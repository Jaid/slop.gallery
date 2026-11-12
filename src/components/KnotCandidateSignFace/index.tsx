import {fitted} from '#src/lib/fitLines.ts'

import css from './style.module.sass'

export const candidateSignBackground = '#10252b'
export const candidateSignTextureSize = [1024, 246] as const

/** The printed face of a model’s sign: its mark and its name, fitted, without exhibit numbers. */
export default function KnotCandidateSignFace({title, icon}: {
  icon?: string
  title: string
}) {
  return <div
    className={css.face} style={{
      width: candidateSignTextureSize[0],
      height: candidateSignTextureSize[1],
      background: candidateSignBackground,
    }}
  >
    <div className={css.border} />
    {icon && <img className={css.icon} alt='' src={icon} />}
    <div className={icon ? `${css.title} ${css.withIcon}` : css.title} {...fitted}>{title}</div>
  </div>
}
