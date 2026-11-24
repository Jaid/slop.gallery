import type {TuningCarryOver} from './carryOver.ts'

import {flyMode} from '#src/lib/gallery/flyMode.ts'
import {playerSession} from '#src/lib/gallery/PlayerSession.ts'

import {carryOverKey} from './carryOver.ts'
import worldTuning from './index.ts'
import {useWorldTuningPanel} from './panel.ts'

/**
 * Reloads the page once a value changes that only applies as the page loads, like the size of a room, which builds its walls, colliders and slots: the next page starts with every value that left its start, where the player is and the panel as it shows, see `carriedTuning`.
 * It reloads a task later, so whatever changed the value, like a WebMCP tool, still answers first. Returns how to stop watching.
 */
export default function reloadForWorldTuning() {
  const built = new Map(worldTuning.modules.map(module => [module, module.get()]))
  let pending: ReturnType<typeof setTimeout> | undefined
  const unsubscribe = worldTuning.subscribe(() => {
    const reloads = worldTuning.modules.some(module => module.entries.keys().some(key => module.reloads(key) && module.get()[key] !== built.get(module)?.[key]))
    if (!reloads || pending !== undefined) {
      return
    }
    pending = setTimeout(() => {
      const carryOver: TuningCarryOver = {
        changes: worldTuning.changes(),
        flying: flyMode.active,
        open: useWorldTuningPanel.getState().open,
        pose: playerSession.snapshot(),
      }
      sessionStorage.setItem(carryOverKey, JSON.stringify(carryOver))
      location.reload()
    })
  })
  return () => {
    unsubscribe()
    clearTimeout(pending)
  }
}
