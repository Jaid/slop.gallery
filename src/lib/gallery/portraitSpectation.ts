import {create} from 'zustand'

import pauseMenu from '../pauseMenu.ts'

type State = {
  /** Puts the view away. */
  close: () => void
  /** the id of the work the pause menu shows up close, in place of its map and its main column, or null while it shows those */
  id: string | null
  /** Shows the work with the id up close, or puts the view away if it already shows that work. */
  toggle: (id: string) => void
}

/** which work the pause menu shows up close: the one the player last clicked in the collection, until they close the view or go on playing */
export const usePortraitSpectation = create<State>(set => ({
  id: null,
  close: () => set({id: null}),
  toggle: id => set(state => ({id: state.id === id ? null : id})),
}))

// The next pause starts with the map again.
pauseMenu.subscribe(() => {
  if (pauseMenu.getSnapshot().locked) {
    usePortraitSpectation.getState().close()
  }
})
