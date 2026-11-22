import type {ArtworkHolder, PortraitModelSubject} from '#src/lib/gallery/PortraitModel.ts'
import type StudioView from '#src/lib/rendering/studio/StudioView.ts'

import PortraitModel from '#src/lib/gallery/PortraitModel.ts'

/** what of a studio view puts a model on its stage and takes it off again */
export type PortraitStage = Pick<StudioView, 'hide' | 'show'>
/** how showing the model of a work ended */
export type StagingOutcome = 'failed' | 'ready'

/**
 * Shows the model of a work on the stage once its artwork has loaded and tells `settle` how that ended. The returned function gives it up: it takes the model off the stage, or keeps it from getting there, never settles and disposes the model once whatever still compiles it is done.
 * A model given up on while its artwork still loads never asks for the stage, so it can’t take the place of a work shown after it.
 * @param hold loads the artwork’s texture, see {@link PortraitModel}
 */
export default function stagePortrait(view: PortraitStage, subject: PortraitModelSubject, settle: (outcome: StagingOutcome) => void, hold?: ArtworkHolder) {
  const model = new PortraitModel(subject, hold)
  let current = true
  const shown = model.loaded.then(() => current && view.show(model.object, model.size)).then(onStage => {
    if (onStage && current) {
      settle('ready')
    }
  }, (error: unknown) => {
    console.warn('The model of a work could not be shown.', error)
    if (current) {
      settle('failed')
    }
  })
  return () => {
    current = false
    view.hide(model.object)
    // Whatever still compiles it has to finish first.
    void shown.finally(() => model.dispose()).catch(() => {})
  }
}
