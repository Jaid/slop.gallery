import type {Node} from 'three/webgpu'

import {uniform} from 'three/tsl'

/** how far a mood with a screen has come, as `MoodMixer` tells it every frame it shows */
export type ScreenShowing = {
  /** the furthest its fade has come since it began showing this time, 0–1, linear in time */
  arrival: number
  /** how far its fade stands now, 0–1, linear in time */
  progress: number
  /** how strongly it shows now, 0–1, eased like its color filters */
  strength: number
}

/**
 * A screen shader a mood draws over the finished frame while it shows, like the Atelier’s painted vignette, instead of or along with color filters.
 * The render pipeline builds every mood’s screen in once, after the moods’ gradient maps and before the dither, and runs each only while its mood shows, so a mood coming over the world compiles nothing. Those showing draw one over the other like their moods stack, the room’s beneath the one cast over the world (see `src/lib/rendering/moodScreens.ts`).
 * Its uniforms tell it how far its mood has come, which `MoodMixer` writes every frame: what it draws can play out as the mood comes in, along with {@link arrival}, go on from there for as long as the mood holds, along with {@link stay}, and leave in a way of its own as {@link presence} falls, or simply fade with {@link strength}. What moves regardless of the mood follows TSL’s `time`, which stands still with the frozen world and under `?frozen_time`, as {@link stay} does.
 * It works in display space, after tone mapping, and places what it draws by `screenUV` and `screenSize`, which also hold in captures of any size.
 */
export default abstract class MoodScreen {
  /** the furthest the mood’s fade has come since it began showing this time, 0–1 and linear in time: it rises along with the fade in and holds while the mood leaves, so whatever played out as the mood came stays as it was */
  readonly arrival = uniform(0)
  /** where in the stack of the screens showing this one draws, 0 at the bottom, or −1 while it doesn’t show */
  readonly layer = uniform(-1, 'int')
  /** how much of what came is still there: 1 while the mood comes in or holds, falling linearly to 0 as it leaves, and rising again if it is asked back before it is gone */
  readonly presence = uniform(0)
  /** seconds since the mood arrived in full, by the shaders’ `time`, and 0 until then: whatever played out along {@link arrival} can go on along it seamlessly, like strokes that were painted drying and being painted again. A mood shown in full at once, like under `?fade=false`, has just arrived. */
  readonly stay = uniform(0).onRenderUpdate(({time}) => this.staying(time))
  /** how strongly the mood shows now, 0–1, eased in and out like its color filters */
  readonly strength = uniform(0)
  /** the shaders’ `time` at which the mood arrived in full, once it has */
  private arrived?: number

  /** whether the screen draws anything this frame */
  get showing() {
    return this.strength.value > 0
  }

  /** The frame’s color in display space with the screen drawn over it as far as its mood has come; built once with the render pipeline and only run while {@link showing}. */
  abstract draw(frame: Node<'vec3'>): Node<'vec3'>

  /** Stops drawing, once the mood is gone. */
  hide() {
    this.arrived = undefined
    this.arrival.value = 0
    this.presence.value = 0
    this.strength.value = 0
  }

  /** Draws as far as the mood has come. */
  show({arrival, progress, strength}: ScreenShowing) {
    this.arrival.value = arrival
    this.presence.value = arrival > 0 ? Math.min(1, progress / arrival) : 0
    this.strength.value = strength
  }

  /** The seconds since the mood arrived in full at `time`, the shaders’ time in seconds, which every frame tells. */
  staying(time: number) {
    if (this.arrival.value < 1) {
      this.arrived = undefined
      return 0
    }
    this.arrived ??= time
    return time - this.arrived
  }
}
