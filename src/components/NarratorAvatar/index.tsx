import avatar from '#root/assets/avatar.jxl' with {distance: '1', format: 'jxl', maximumLong: '256'}

import css from './style.module.sass'

/** The narrator as the gallery’s own “Son of Man”, a bowler-hatted gentleman with a slop of slime in front of his face. */
export default function NarratorAvatar() {
  return <img className={css.container} alt='' data-testid='narrator-avatar' height={68} src={avatar} width={68} />
}
