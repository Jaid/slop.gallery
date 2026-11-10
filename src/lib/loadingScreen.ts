import hide, {findLoadingScreen} from 'vite-plugin-loading-screen/client'
import {create} from 'zustand'

/** Whether the title that index.html paints over the world’s wallpaper still covers the page, which it does until the scene is ready. */
export const useLoadingScreen = create<{shown: boolean}>(() => ({shown: findLoadingScreen() !== null}))

/** Fades the loading screen out to whatever is behind it, then removes it for good. */
export function hideLoadingScreen() {
  if (!useLoadingScreen.getState().shown) {
    return
  }
  // The menu mounts with this state change, so the screen’s title can glide to where the menu shows its own.
  useLoadingScreen.setState({shown: false})
  // eslint-disable-next-line typescript/no-floating-promises -- It never rejects, and nothing waits for the screen to be gone.
  void hide({titleTarget: '#menu-title'})
}
