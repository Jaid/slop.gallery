import type MoodScreen from '#src/moods/base/MoodScreen.ts'
import type {Node} from 'three/webgpu'

import {Fn, If, vec4} from 'three/tsl'

/**
 * Draws the moods’ screens over `frame`, a color in display space, one over the other in their order, each only while its mood shows.
 * They all compile with the pipeline, so a mood coming over the world builds nothing, and a screen whose mood doesn’t show costs a uniform branch per pixel.
 */
export function drawMoodScreens(frame: Node<'vec4'>, screens: ReadonlyArray<MoodScreen>): Node<'vec4'> {
  if (!screens.length) {
    return frame
  }
  return Fn(() => {
    const drawn = vec4(frame).toVar('moodScreenColor')
    for (const screen of screens) {
      If(screen.strength.greaterThan(0), () => {
        drawn.assign(screen.draw(drawn))
      })
    }
    return drawn
  })()
}
