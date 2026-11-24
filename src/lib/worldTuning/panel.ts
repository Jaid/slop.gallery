import {create} from 'zustand'

import {carriedTuning} from './carryOver.ts'
import {readWorldTuning} from './worldTuningParameter.ts'

/** key that shows or hides the world tuning panel with `?development` */
export const worldTuningKey = 'KeyG'

/** Whether the world tuning panel shows, from the start with `?world_tuning` or after a reload it asked for while it showed, and whether the pointer is over it, which hides the pause menu so the scene shows every change. */
export const useWorldTuningPanel = create<{
  hovered: boolean
  open: boolean
}>(() => ({
  hovered: false,
  open: readWorldTuning() || (carriedTuning?.open ?? false),
}))

/** Shows the world tuning panel or hides it. */
export function toggleWorldTuning() {
  useWorldTuningPanel.setState(state => ({
    hovered: false,
    open: !state.open,
  }))
}
