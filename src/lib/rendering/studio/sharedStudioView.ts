import StudioView from './StudioView.ts'

type Shared = {
  /** how many hold it */
  holders: number
  idle: ReturnType<typeof setTimeout> | undefined
  view: StudioView
}

/** how long the studio view outlives its last holder, in ms: closing and opening the menu’s view again shouldn’t ask for a GPU device and compile every pipeline anew each time */
const idleMs = 60_000
/** the one studio view of the page, as it has one canvas, which can be in one place */
let shared: Shared | undefined

/**
 * Hands out the page’s studio view, created with the first holder, until `release` is called, which only counts once.
 * A minute after its last holder let go of it, its GPU device is released.
 */
export default function holdStudioView() {
  shared ??= {
    view: new StudioView,
    holders: 0,
    idle: undefined,
  }
  const studio = shared
  clearTimeout(studio.idle)
  studio.holders++
  let held = true
  return {
    view: studio.view,
    release: () => {
      if (!held) {
        return
      }
      held = false
      if (--studio.holders > 0) {
        return
      }
      studio.idle = setTimeout(() => {
        if (shared === studio) {
          shared = undefined
        }
        studio.view.dispose()
      }, idleMs)
    },
  }
}
