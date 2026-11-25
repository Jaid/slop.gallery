import clsx from 'clsx'

import {maximumImportFiles} from '#src/lib/gallery/imagePolicy.ts'

import css from './style.module.sass'

const messages = {
  idle: {
    title: 'Make an entrance.',
    description: 'Aim at an empty wall, or drop to place it in front of you.',
  },
  valid: {
    title: 'It would look lovely here.',
    description: 'Drop to hang. The final size is checked before placement.',
  },
  collecting: {
    title: 'Straight into the collection.',
    description: 'Drop to add it to your works. It waits at your feet once you resume.',
  },
  rejected: {
    title: 'Not quite a canvas.',
    description: `Only the first ${maximumImportFiles} files will be imported.`,
  },
}

export default function ArtworkDropOverlay({collecting, rejected, valid}: {
  /** whether the work goes into the collection, dragged in under the pause menu, instead of aiming into the scene */
  collecting: boolean
  rejected: boolean
  valid: boolean
}) {
  let message = messages.idle
  if (rejected) {
    message = messages.rejected
  } else if (collecting) {
    message = messages.collecting
  } else if (valid) {
    message = messages.valid
  }
  return <div className={clsx(css.container, rejected && css.rejected)} data-testid='drop-overlay'>
    <div className={css.card}><span className={css.eyebrow}>A NEW ARRIVAL</span><h2>{message.title}</h2>
      <p>{message.description}</p>
      <small>JXL · PNG · JPEG · WEBP · AVIF · GIF · SVG / VIDEOS USE THEIR FIRST FRAME / UP TO {maximumImportFiles} AT ONCE</small></div>
  </div>
}
