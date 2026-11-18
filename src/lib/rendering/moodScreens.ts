import type MoodScreen from '#src/moods/base/MoodScreen.ts'
import type {Node} from 'three/webgpu'

import {Fn, If, Loop, uniform, vec4} from 'three/tsl'

/** how many screens show now, one over the other */
const height = uniform(0, 'int')
/** the screens showing now, from the bottom of the stack to its top */
let shown: ReadonlyArray<MoodScreen> = []

/**
 * Shows `screens` in every frame that {@link drawMoodScreens} passes, each over the ones before it, like their moods stack, or nothing without any.
 * Only uniforms change, so a mood coming or going rebuilds no shader.
 */
export function showMoodScreens(screens: ReadonlyArray<MoodScreen>) {
  for (const screen of shown) {
    screen.layer.value = -1
  }
  for (const [layer, screen] of screens.entries()) {
    screen.layer.value = layer
  }
  height.value = screens.length
  shown = screens
}

/**
 * Draws the moods’ screens over `frame`, a color in display space, after the output transform. Its alpha stays as it is.
 * All of `screens` compile into the one shader up front, so a mood coming over the world builds nothing. Those showing run in the order {@link showMoodScreens} was told, whichever that is, and with none showing a pixel pays for one comparison.
 */
export function drawMoodScreens(frame: Node<'vec4'>, screens: ReadonlyArray<MoodScreen>): Node<'vec4'> {
  if (!screens.length) {
    return frame
  }
  return Fn(() => {
    const source = frame.toVar('moodScreenSource')
    const drawn = source.rgb.toVar('moodScreenColor')
    Loop(height, ({i}) => {
      for (const screen of screens) {
        If(screen.layer.equal(i), () => {
          drawn.assign(screen.draw(drawn))
        })
      }
    })
    return vec4(drawn, source.a)
  })()
}
